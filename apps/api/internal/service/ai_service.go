package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"

	"github.com/my-notion/yestion/api/internal/model"
	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/openai/openai-go/shared"
)

// ChatMessage is one message in a chat conversation.
type ChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// AIService streams chat completions from an OpenAI-compatible API (DeepSeek)
// and optionally grounds the answer in Zvec search results.
type AIService interface {
	Ready() error
	StreamChat(
		ctx context.Context,
		userID, workspaceID, pageID string,
		workspaces []KnowledgeWorkspace,
		messages []ChatMessage,
		useKnowledge bool,
		thinkingEnabled bool,
		writer io.Writer,
	) error
}

// KnowledgeWorkspace is a workspace whose collection may be searched for
// knowledge. Workspace membership is enforced before building this list.
type KnowledgeWorkspace struct {
	ID   string
	Name string
}

type aiService struct {
	zvec     *ZVecClient
	apiKey   string
	baseURL  string
	model    string
	topK     int
	maxScore float64
	margin   float64
	minChars int
	tools    ToolRunner
}

func NewAIService(
	zvec *ZVecClient,
	apiKey, baseURL, model string,
	topK int,
	maxScore, margin float64,
	minChars int,
	tools ToolRunner,
) AIService {
	return &aiService{
		zvec: zvec, apiKey: apiKey, baseURL: strings.TrimSuffix(baseURL, "/"),
		model: model, topK: topK, maxScore: maxScore,
		margin: margin, minChars: minChars,
		tools: tools,
	}
}

func (s *aiService) Ready() error {
	if s.apiKey == "" {
		return errors.New("DEEPSEEK_API_KEY is not configured")
	}
	return nil
}

func (s *aiService) StreamChat(
	ctx context.Context,
	userID, workspaceID, pageID string,
	workspaces []KnowledgeWorkspace,
	messages []ChatMessage,
	useKnowledge bool,
	thinkingEnabled bool,
	writer io.Writer,
) error {
	if err := s.Ready(); err != nil {
		return err
	}
	if len(messages) == 0 {
		return errors.New("messages are required")
	}

	system := "你是 Yestion 的 AI 助手，帮助用户在个人工作区中创建内容、查找信息、总结内容和回答问题。" +
		"回答使用与问题相同的语言，保持简洁、准确。你可以调用工具真正执行用户请求：" +
		"create_document（在当前工作区新建文档）、create_subdocument（在当前文档下新建子文档）、" +
		"create_workspace（新建工作区）。当用户询问工作区中的内容时，调用 search_workspace 检索后再回答。" +
		"不要编造文档已存在或已创建；只有工具返回成功才算创建成功。"

	flusher, _ := writer.(http.Flusher)

	apiMessages := make([]openai.ChatCompletionMessageParamUnion, 0, len(messages)+1)
	apiMessages = append(apiMessages, openai.SystemMessage(system))
	for _, message := range messages {
		switch message.Role {
		case "user":
			apiMessages = append(apiMessages, openai.UserMessage(message.Content))
		case "assistant":
			apiMessages = append(apiMessages, openai.AssistantMessage(message.Content))
		}
	}

	client := openai.NewClient(
		option.WithAPIKey(s.apiKey),
		option.WithBaseURL(s.baseURL),
	)
	requestOptions := make([]option.RequestOption, 0, 1)
	if !thinkingEnabled {
		requestOptions = append(
			requestOptions,
			option.WithJSONSet("thinking", map[string]string{"type": "disabled"}),
		)
	}

	var tools []openai.ChatCompletionToolParam
	if workspaceID != "" {
		tools = append(tools,
			documentTool("create_document"),
			documentTool("create_subdocument"),
		)
	}
	tools = append(tools, workspaceTool())
	if useKnowledge && s.zvec != nil && len(workspaces) > 0 {
		tools = append(tools, searchTool())
	}

	sourcesEmitted := false
	for round := 0; round < 4; round++ {
		calls, err := s.streamOnce(
			ctx, client, apiMessages, tools, thinkingEnabled,
			requestOptions, writer, flusher, workspaces, &sourcesEmitted,
		)
		if err != nil {
			return err
		}
		if len(calls) == 0 {
			break
		}

		apiMessages = append(apiMessages, assistantToolCallMessage(calls))
		for _, call := range calls {
			var result string
			if call.name == "search_workspace" {
				result = s.runSearchTool(ctx, workspaces, call.args, writer, flusher, &sourcesEmitted)
			} else {
				var err error
				result, err = s.tools.Run(ctx, userID, workspaceID, pageID, call.name, call.args)
				if err != nil {
					result = fmt.Sprintf(`{"ok":false,"tool":%q,"error":%q}`, call.name, err.Error())
				}
				if err := emitToolEvent(writer, flusher, result); err != nil {
					return err
				}
			}
			apiMessages = append(apiMessages, openai.ToolMessage(result, call.id))
		}
	}
	return writeSSE(writer, flusher, "[DONE]", false)
}

type toolCall struct {
	id      string
	name    string
	argsRaw string
	args    map[string]any
}

func (s *aiService) streamOnce(
	ctx context.Context,
	client openai.Client,
	messages []openai.ChatCompletionMessageParamUnion,
	tools []openai.ChatCompletionToolParam,
	thinkingEnabled bool,
	requestOptions []option.RequestOption,
	writer io.Writer,
	flusher http.Flusher,
	workspaces []KnowledgeWorkspace,
	sourcesEmitted *bool,
) ([]toolCall, error) {
	params := openai.ChatCompletionNewParams{
		Model:    openai.ChatModel(s.model),
		Messages: messages,
	}
	if len(tools) > 0 {
		params.Tools = tools
	}
	stream := client.Chat.Completions.NewStreaming(ctx, params, requestOptions...)

	var calls []toolCall
	for stream.Next() {
		chunk := stream.Current()
		for _, choice := range chunk.Choices {
			if reasoning := deltaReasoningContent(choice.Delta); reasoning != "" {
				if err := writeSSE(writer, flusher, reasoning, true); err != nil {
					return nil, err
				}
				continue
			}
			if content := choice.Delta.Content; content != "" {
				if err := writeSSE(writer, flusher, content, false); err != nil {
					return nil, err
				}
			}
			for _, toolCallDelta := range choice.Delta.ToolCalls {
				index := int(toolCallDelta.Index)
				for len(calls) <= index {
					calls = append(calls, toolCall{})
				}
				if toolCallDelta.ID != "" {
					calls[index].id = toolCallDelta.ID
				}
				if toolCallDelta.Function.Name != "" {
					calls[index].name = toolCallDelta.Function.Name
				}
				calls[index].argsRaw += toolCallDelta.Function.Arguments
			}
		}
	}
	if err := stream.Err(); err != nil {
		return nil, err
	}
	for i := range calls {
		calls[i].args = map[string]any{}
		if calls[i].argsRaw != "" {
			_ = json.Unmarshal([]byte(calls[i].argsRaw), &calls[i].args)
		}
	}
	return calls, nil
}

func assistantToolCallMessage(calls []toolCall) openai.ChatCompletionMessageParamUnion {
	toolCalls := make([]openai.ChatCompletionMessageToolCallParam, 0, len(calls))
	for _, call := range calls {
		toolCalls = append(toolCalls, openai.ChatCompletionMessageToolCallParam{
			ID: call.id,
			Function: openai.ChatCompletionMessageToolCallFunctionParam{
				Name:      call.name,
				Arguments: call.argsRaw,
			},
		})
	}
	return openai.ChatCompletionMessageParamUnion{
		OfAssistant: &openai.ChatCompletionAssistantMessageParam{ToolCalls: toolCalls},
	}
}

func (s *aiService) runSearchTool(
	ctx context.Context,
	workspaces []KnowledgeWorkspace,
	args map[string]any,
	writer io.Writer,
	flusher http.Flusher,
	sourcesEmitted *bool,
) string {
	query := strings.TrimSpace(stringValue(args["query"]))
	if query == "" {
		return `{"ok":false,"error":"检索关键词不能为空"}`
	}
	var sources []model.ChatSource
	for _, workspace := range workspaces {
		hits, err := s.zvec.Search(ctx, workspace.ID, query, s.topK)
		if err != nil {
			return fmt.Sprintf(`{"ok":false,"error":%q}`, err.Error())
		}
		for _, hit := range filterBasic(hits, s.maxScore, s.minChars) {
			sources = append(sources, model.ChatSource{
				WorkspaceID:   workspace.ID,
				WorkspaceName: workspace.Name,
				DocumentID:    hit.DocumentID,
				Title:         hit.Title,
				Content:       hit.Content,
				DocType:       hit.Type,
				Score:         hit.Score,
			})
		}
	}
	sort.Slice(sources, func(i, j int) bool {
		return sources[i].Score < sources[j].Score
	})
	sources = trimByMargin(sources, s.margin)
	if len(sources) > s.topK {
		sources = sources[:s.topK]
	}

	if len(sources) > 0 && !*sourcesEmitted {
		*sourcesEmitted = true
		if err := writeSSESources(writer, flusher, sources); err != nil {
			return fmt.Sprintf(`{"ok":false,"error":%q}`, err.Error())
		}
	}

	if len(sources) == 0 {
		return `{"ok":true,"results":[]}`
	}
	var builder strings.Builder
	for i, source := range sources {
		fmt.Fprintf(
			&builder,
			"[文档 %d] %s（工作区：%s）\n%s\n\n",
			i+1,
			source.Title,
			source.WorkspaceName,
			strings.TrimSpace(source.Content),
		)
	}
	return `{"ok":true,"results":` + jsonString(builder.String()) + `}`
}

func jsonString(value string) string {
	data, _ := json.Marshal(value)
	return string(data)
}

func emitToolEvent(writer io.Writer, flusher http.Flusher, result string) error {
	var payload map[string]any
	if err := json.Unmarshal([]byte(result), &payload); err != nil {
		payload = map[string]any{"ok": false, "error": result}
	}
	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(writer, "event: tool\ndata: %s\n\n", data); err != nil {
		return err
	}
	if flusher != nil {
		flusher.Flush()
	}
	return nil
}

func documentTool(name string) openai.ChatCompletionToolParam {
	return openai.ChatCompletionToolParam{
		Function: shared.FunctionDefinitionParam{
			Name:        name,
			Description: openai.String("在当前工作区中新建文档。title 为文档标题，content 为文档正文（可选）。"),
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"title":   map[string]any{"type": "string", "description": "文档标题"},
					"content": map[string]any{"type": "string", "description": "文档正文（可选）"},
				},
				"required": []string{"title"},
			},
		},
	}
}

func workspaceTool() openai.ChatCompletionToolParam {
	return openai.ChatCompletionToolParam{
		Function: shared.FunctionDefinitionParam{
			Name:        "create_workspace",
			Description: openai.String("新建一个工作区。name 为工作区名称。"),
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"name": map[string]any{"type": "string", "description": "工作区名称"},
				},
				"required": []string{"name"},
			},
		},
	}
}

func searchTool() openai.ChatCompletionToolParam {
	return openai.ChatCompletionToolParam{
		Function: shared.FunctionDefinitionParam{
			Name:        "search_workspace",
			Description: openai.String("检索用户工作区中的文档内容，返回与查询相关的结果。当用户询问工作区内容时调用。"),
			Parameters: map[string]any{
				"type": "object",
				"properties": map[string]any{
					"query": map[string]any{"type": "string", "description": "检索关键词或问题"},
				},
				"required": []string{"query"},
			},
		},
	}
}

// filterSources drops documents that carry no text or are too far from the
// query, so empty or unrelated pages are not shown as sources.
func filterBasic(hits []ZVecHit, maxScore float64, minChars int) []ZVecHit {
	candidates := make([]ZVecHit, 0, len(hits))
	for _, hit := range hits {
		if len(strings.TrimSpace(hit.Content)) < minChars {
			continue
		}
		if maxScore > 0 && hit.Score > maxScore {
			continue
		}
		candidates = append(candidates, hit)
	}
	return candidates
}

// trimByMargin keeps only sources reasonably close to the best global match;
// a large distance gap means the rest are effectively unrelated.
func trimByMargin(sources []model.ChatSource, margin float64) []model.ChatSource {
	if margin <= 0 || len(sources) == 0 {
		return sources
	}
	best := sources[0].Score
	for _, source := range sources[1:] {
		if source.Score < best {
			best = source.Score
		}
	}
	filtered := sources[:0]
	for _, source := range sources {
		if source.Score <= best+margin {
			filtered = append(filtered, source)
		}
	}
	return filtered
}

type zvecDeltaJSON struct {
	ReasoningContent string `json:"reasoning_content"`
}

// deltaReasoningContent extracts DeepSeek's reasoning_content from the raw
// delta JSON, which the OpenAI SDK does not model as a typed field.
func deltaReasoningContent(delta openai.ChatCompletionChunkChoiceDelta) string {
	raw := delta.RawJSON()
	if raw == "" {
		return ""
	}
	var payload zvecDeltaJSON
	if err := json.Unmarshal([]byte(raw), &payload); err != nil {
		return ""
	}
	return payload.ReasoningContent
}

// writeSSE writes an OpenAI-compatible SSE data frame: an assistant delta
// (content or reasoning_content) or [DONE].
func writeSSE(writer io.Writer, flusher http.Flusher, content string, reasoning bool) error {
	var frame string
	if content == "[DONE]" {
		frame = "data: [DONE]"
	} else {
		delta := map[string]any{"content": content}
		if reasoning {
			delta = map[string]any{"reasoning_content": content}
		}
		payload, err := json.Marshal(map[string]any{
			"choices": []any{map[string]any{
				"delta": delta,
			}},
		})
		if err != nil {
			return err
		}
		frame = "data: " + string(payload)
	}
	if _, err := fmt.Fprintf(writer, "%s\n\n", frame); err != nil {
		return err
	}
	if flusher != nil {
		flusher.Flush()
	}
	return nil
}

// writeSSESources emits an SSE event with the workspace documents retrieved
// for the current question, so the frontend can render them as Sources.
func writeSSESources(writer io.Writer, flusher http.Flusher, sources []model.ChatSource) error {
	payload, err := json.Marshal(map[string]any{"sources": sources})
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(writer, "event: sources\ndata: %s\n\n", payload); err != nil {
		return err
	}
	if flusher != nil {
		flusher.Flush()
	}
	return nil
}

// WriteSSEError writes an SSE error frame after streaming has started.
func WriteSSEError(writer io.Writer, err error) error {
	payload, marshalErr := json.Marshal(map[string]any{"error": err.Error()})
	if marshalErr != nil {
		return marshalErr
	}
	_, writeErr := fmt.Fprintf(writer, "data: %s\n\n", payload)
	if flusher, ok := writer.(http.Flusher); ok {
		flusher.Flush()
	}
	return writeErr
}
