package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
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
	StreamChat(ctx context.Context, workspaceID string, messages []ChatMessage, useKnowledge bool, writer io.Writer) error
}

type aiService struct {
	zvec    *ZVecClient
	apiKey  string
	baseURL string
	model   string
	topK    int
}

func NewAIService(zvec *ZVecClient, apiKey, baseURL, model string, topK int) AIService {
	return &aiService{zvec: zvec, apiKey: apiKey, baseURL: strings.TrimSuffix(baseURL, "/"), model: model, topK: topK}
}

func (s *aiService) Ready() error {
	if s.apiKey == "" {
		return errors.New("DEEPSEEK_API_KEY is not configured")
	}
	return nil
}

func (s *aiService) StreamChat(
	ctx context.Context,
	workspaceID string,
	messages []ChatMessage,
	useKnowledge bool,
	writer io.Writer,
) error {
	if err := s.Ready(); err != nil {
		return err
	}
	if len(messages) == 0 {
		return errors.New("messages are required")
	}

	question := messages[len(messages)-1].Content
	system := "你是 Yestion 的 AI 助手，帮助用户在个人工作区中查找信息、总结内容和回答问题。回答使用与问题相同的语言，保持简洁、准确。"

	if useKnowledge && s.zvec != nil && strings.TrimSpace(question) != "" {
		hits, err := s.zvec.Search(ctx, workspaceID, question, s.topK)
		if err != nil {
			return fmt.Errorf("search local knowledge: %w", err)
		}
		if len(hits) > 0 {
			var contextBuilder strings.Builder
			contextBuilder.WriteString("\n\n以下是与你问题相关的本地文档内容：\n")
			for i, hit := range hits {
				fmt.Fprintf(&contextBuilder, "\n[文档 %d] %s\n%s\n", i+1, hit.Title, strings.TrimSpace(hit.Content))
			}
			contextBuilder.WriteString("\n请优先基于这些本地文档回答；如果文档中没有相关信息，请如实说明，不要编造。")
			system += contextBuilder.String()
		}
	}

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
	stream := client.Chat.Completions.NewStreaming(ctx, openai.ChatCompletionNewParams{
		Model:    openai.ChatModel(s.model),
		Messages: apiMessages,
	})

	flusher, _ := writer.(http.Flusher)
	for stream.Next() {
		chunk := stream.Current()
		for _, choice := range chunk.Choices {
			content := choice.Delta.Content
			if content == "" {
				continue
			}
			if err := writeSSE(writer, flusher, content); err != nil {
				return err
			}
		}
	}
	if err := stream.Err(); err != nil {
		return err
	}
	return writeSSE(writer, flusher, "[DONE]")
}

// writeSSE writes an OpenAI-compatible SSE data frame: an assistant delta or [DONE].
func writeSSE(writer io.Writer, flusher http.Flusher, content string) error {
	var frame string
	if content == "[DONE]" {
		frame = "data: [DONE]"
	} else {
		payload, err := json.Marshal(map[string]any{
			"choices": []any{map[string]any{
				"delta": map[string]any{"content": content},
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
