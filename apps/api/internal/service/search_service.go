package service

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/my-notion/yestion/api/internal/repository"
)

type SearchResult struct {
	BlockID     string `json:"blockId"`
	WorkspaceID string `json:"workspaceId"`
	Title       string `json:"title"`
	Type        string `json:"type"`
	Snippet     string `json:"snippet"`
}

type SearchService interface {
	Search(ctx context.Context, userID, query string) ([]SearchResult, error)
}

type searchService struct {
	workspaces repository.WorkspaceRepository
	blocks     repository.BlockRepository
}

func NewSearchService(
	workspaces repository.WorkspaceRepository,
	blocks repository.BlockRepository,
) SearchService {
	return &searchService{workspaces: workspaces, blocks: blocks}
}

func (s *searchService) Search(ctx context.Context, userID, query string) ([]SearchResult, error) {
	query = strings.ToLower(strings.TrimSpace(query))
	if query == "" {
		return []SearchResult{}, nil
	}

	workspaces, err := s.workspaces.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0)
	for _, workspace := range workspaces {
		blocks, err := s.blocks.ListByWorkspace(ctx, workspace.ID)
		if err != nil {
			return nil, err
		}

		for _, block := range blocks {
			title := propertyString(block.Properties["title"])
			content := propertyString(block.Properties["content"])
			titleMatch := strings.Contains(strings.ToLower(title), query)
			contentMatch := strings.Contains(strings.ToLower(content), query)
			if !titleMatch && !contentMatch {
				continue
			}

			results = append(results, SearchResult{
				BlockID:     block.ID,
				WorkspaceID: workspace.ID,
				Title:       title,
				Type:        block.Type,
				Snippet:     snippetFor(content, query),
			})
		}
	}

	sort.SliceStable(results, func(i, j int) bool {
		leftTitle := strings.Contains(strings.ToLower(results[i].Title), query)
		rightTitle := strings.Contains(strings.ToLower(results[j].Title), query)
		if leftTitle != rightTitle {
			return leftTitle
		}
		return results[i].Title < results[j].Title
	})

	return results, nil
}

func propertyString(value any) string {
	if value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return fmt.Sprint(value)
}

func snippetFor(content, query string) string {
	content = strings.ReplaceAll(content, "\n", " ")
	content = strings.ReplaceAll(content, "\t", " ")
	lowerContent := strings.ToLower(content)
	index := strings.Index(lowerContent, query)
	if index < 0 {
		if len(content) > 120 {
			return strings.TrimSpace(content[:120]) + "..."
		}
		return strings.TrimSpace(content)
	}

	start := index - 40
	if start < 0 {
		start = 0
	}
	end := index + len(query) + 80
	if end > len(content) {
		end = len(content)
	}
	prefix := ""
	suffix := ""
	if start > 0 {
		prefix = "..."
	}
	if end < len(content) {
		suffix = "..."
	}
	return prefix + strings.TrimSpace(content[start:end]) + suffix
}
