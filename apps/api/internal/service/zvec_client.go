package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ZVecClient talks to the Zvec RESTful service (apps/services/zvec).
type ZVecClient struct {
	baseURL string
	client  *http.Client
}

func NewZVecClient(baseURL string) *ZVecClient {
	return &ZVecClient{
		baseURL: strings.TrimSuffix(baseURL, "/"),
		client:  &http.Client{Timeout: 120 * time.Second},
	}
}

type zvecDocumentPayload struct {
	Title   string `json:"title"`
	Content string `json:"content"`
	Type    string `json:"type"`
}

type zvecUpsertResponse struct {
	OK        bool      `json:"ok"`
	Embedding []float32 `json:"embedding"`
}

type zvecQueryPayload struct {
	Query string `json:"query"`
	TopK  int    `json:"topk"`
}

// ZVecHit is a single search result from a Zvec collection.
type ZVecHit struct {
	DocumentID string  `json:"documentId"`
	Title      string  `json:"title"`
	Content    string  `json:"content"`
	Type       string  `json:"type"`
	Score      float64 `json:"score"`
}

type zvecSearchResponse struct {
	Results []ZVecHit `json:"results"`
}

func (c *ZVecClient) do(ctx context.Context, method, path string, body any, out any) error {
	var reader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request: %w", err)
		}
		reader = bytes.NewReader(data)
	}

	request, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, reader)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}

	response, err := c.client.Do(request)
	if err != nil {
		return fmt.Errorf("zvec request %s %s: %w", method, path, err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		data, _ := io.ReadAll(io.LimitReader(response.Body, 4096))
		return fmt.Errorf("zvec %s %s returned %d: %s", method, path, response.StatusCode, strings.TrimSpace(string(data)))
	}
	if out != nil {
		if err := json.NewDecoder(response.Body).Decode(out); err != nil {
			return fmt.Errorf("decode zvec response: %w", err)
		}
	}
	return nil
}

func escapeSegment(value string) string {
	return url.PathEscape(value)
}

// EnsureCollection creates the workspace collection if it does not exist yet.
func (c *ZVecClient) EnsureCollection(ctx context.Context, workspaceID string) error {
	return c.do(ctx, http.MethodPost, "/collections/"+escapeSegment(workspaceID), nil, nil)
}

// DestroyCollection removes the workspace collection and all of its documents.
func (c *ZVecClient) DestroyCollection(ctx context.Context, workspaceID string) error {
	return c.do(ctx, http.MethodDelete, "/collections/"+escapeSegment(workspaceID), nil, nil)
}

// UpsertDocument embeds and indexes a document, returning its embedding vector.
func (c *ZVecClient) UpsertDocument(
	ctx context.Context,
	workspaceID, documentID, title, content, docType string,
) ([]float32, error) {
	var out zvecUpsertResponse
	path := "/collections/" + escapeSegment(workspaceID) + "/documents/" + escapeSegment(documentID)
	err := c.do(ctx, http.MethodPut, path, zvecDocumentPayload{
		Title:   title,
		Content: content,
		Type:    docType,
	}, &out)
	if err != nil {
		return nil, err
	}
	return out.Embedding, nil
}

// DeleteDocument removes a document from the workspace collection.
func (c *ZVecClient) DeleteDocument(ctx context.Context, workspaceID, documentID string) error {
	path := "/collections/" + escapeSegment(workspaceID) + "/documents/" + escapeSegment(documentID)
	return c.do(ctx, http.MethodDelete, path, nil, nil)
}

// Search runs a semantic search over the workspace collection.
func (c *ZVecClient) Search(ctx context.Context, workspaceID, query string, topK int) ([]ZVecHit, error) {
	var out zvecSearchResponse
	err := c.do(ctx, http.MethodPost, "/collections/"+escapeSegment(workspaceID)+"/query", zvecQueryPayload{
		Query: query,
		TopK:  topK,
	}, &out)
	if err != nil {
		return nil, err
	}
	return out.Results, nil
}
