package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
)

// ToolRunner executes agent tools on behalf of the chat model.
type ToolRunner interface {
	Run(
		ctx context.Context,
		userID, workspaceID, pageID, tool string,
		args map[string]any,
	) (string, error)
}

type documentToolRunner struct {
	workspaces WorkspaceService
	blocks     BlockService
}

func NewDocumentToolRunner(workspaces WorkspaceService, blocks BlockService) ToolRunner {
	return &documentToolRunner{workspaces: workspaces, blocks: blocks}
}

func (r *documentToolRunner) Run(
	ctx context.Context,
	userID, workspaceID, pageID, tool string,
	args map[string]any,
) (string, error) {
	title := strings.TrimSpace(stringValue(args["title"]))
	content := strings.TrimSpace(stringValue(args["content"]))
	name := strings.TrimSpace(stringValue(args["name"]))

	switch tool {
	case "create_document":
		if workspaceID == "" {
			return "", fmt.Errorf("未指定工作区，无法创建文档")
		}
		if title == "" {
			return "", fmt.Errorf("文档标题不能为空")
		}
		block, err := r.blocks.Create(ctx, userID, workspaceID, nil, "page", title)
		if err != nil {
			return "", err
		}
		if content != "" {
			_, err = r.blocks.Update(ctx, userID, block.ID, title, map[string]any{
				"content": paragraphDocument(content),
			})
			if err != nil {
				return "", err
			}
		}
		return fmt.Sprintf(
			`{"ok":true,"tool":"create_document","id":%q,"title":%q}`,
			block.ID,
			block.Properties["title"],
		), nil

	case "create_subdocument":
		if workspaceID == "" || pageID == "" {
			return "", fmt.Errorf("未指定上级页面，无法创建子文档")
		}
		if title == "" {
			return "", fmt.Errorf("文档标题不能为空")
		}
		parent := pageID
		block, err := r.blocks.Create(ctx, userID, workspaceID, &parent, "page", title)
		if err != nil {
			return "", err
		}
		if content != "" {
			_, err = r.blocks.Update(ctx, userID, block.ID, title, map[string]any{
				"content": paragraphDocument(content),
			})
			if err != nil {
				return "", err
			}
		}
		return fmt.Sprintf(
			`{"ok":true,"tool":"create_subdocument","id":%q,"title":%q}`,
			block.ID,
			block.Properties["title"],
		), nil

	case "create_workspace":
		if name == "" {
			return "", fmt.Errorf("工作区名称不能为空")
		}
		workspace, err := r.workspaces.Create(ctx, userID, name, "")
		if err != nil {
			return "", err
		}
		return fmt.Sprintf(
			`{"ok":true,"tool":"create_workspace","id":%q,"name":%q}`,
			workspace.ID,
			workspace.Name,
		), nil
	}

	return "", fmt.Errorf("unknown tool %q", tool)
}

func stringValue(value any) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	data, _ := json.Marshal(value)
	return string(data)
}

// paragraphDocument wraps markdown-ish text into a single Tiptap paragraph.
func paragraphDocument(content string) map[string]any {
	return map[string]any{
		"type": "doc",
		"content": []any{
			map[string]any{
				"type": "paragraph",
				"content": []any{
					map[string]any{"type": "text", "text": content},
				},
			},
		},
	}
}
