package store

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/usememos/memos/internal/identifier"
)

// Whiteboard is an independent drawing document. Relations use internal IDs.
type Whiteboard struct {
	ID                    int32
	UID                   string
	CreatorID             int32
	RowStatus             RowStatus
	CreatedTs             int64
	UpdatedTs             int64
	Title                 string
	Tags                  []string
	Document              json.RawMessage
	ThumbnailAttachmentID *int32
}

// WhiteboardPayload persists tags using the existing JSON payload convention.
type WhiteboardPayload struct {
	Tags []string `json:"tags"`
}

// FindWhiteboard selects boards; nil CreatorID is reserved for trusted/admin callers.
type FindWhiteboard struct {
	ID              *int32
	UID             *string
	CreatorID       *int32
	RowStatus       *RowStatus
	Filters         []string
	OrderBy         string
	Limit           *int
	Offset          *int
	ExcludeDocument bool
}

// UpdateWhiteboard patches fields by stable identity. ClearThumbnail explicitly unsets it.
type UpdateWhiteboard struct {
	ID                    int32
	Title                 *string
	Tags                  *[]string
	Document              *json.RawMessage
	ThumbnailAttachmentID *int32
	ClearThumbnail        bool
	RowStatus             *RowStatus
	UpdatedTs             *int64
}

// DeleteWhiteboard permanently removes one board, preserving unlinked attachments.
type DeleteWhiteboard struct {
	ID int32
}

// WhiteboardOrderSQL maps a bounded public sort specification to SQL identifiers.
// The stable ID tie-breaker keeps offset pagination deterministic for equal values.
func WhiteboardOrderSQL(orderBy string) (string, error) {
	if strings.TrimSpace(orderBy) == "" {
		return "updated_ts DESC, id DESC", nil
	}
	parts := strings.Fields(orderBy)
	if len(parts) < 1 || len(parts) > 2 {
		return "", errors.New("order_by requires one field and optional asc/desc")
	}
	column, ok := map[string]string{"update_time": "updated_ts", "create_time": "created_ts", "title": "title"}[parts[0]]
	if !ok {
		return "", errors.New("unsupported whiteboard order field")
	}
	direction := "DESC"
	if len(parts) == 2 {
		direction = strings.ToUpper(parts[1])
		if direction != "ASC" && direction != "DESC" {
			return "", errors.New("unsupported whiteboard order direction")
		}
	}
	return column + " " + direction + ", id " + direction, nil
}

// NormalizeWhiteboardTags trims metadata and removes exact duplicates in order.
func NormalizeWhiteboardTags(tags []string) []string {
	result := []string{}
	seen := map[string]bool{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag != "" && !seen[tag] {
			seen[tag] = true
			result = append(result, tag)
		}
	}
	return result
}

// ValidateWhiteboardDocument checks the JSON envelope only, never tldraw records.
func ValidateWhiteboardDocument(document json.RawMessage) error {
	value := strings.TrimSpace(string(document))
	if !json.Valid(document) || !strings.HasPrefix(value, "{") {
		return errors.New("document must be a JSON object")
	}
	return nil
}

// CreateWhiteboard validates metadata and persists a new document.
func (s *Store) CreateWhiteboard(ctx context.Context, create *Whiteboard) (*Whiteboard, error) {
	if create == nil || !identifier.UIDMatcher.MatchString(create.UID) || create.CreatorID <= 0 {
		return nil, errors.New("whiteboard requires a valid UID and creator")
	}
	if strings.TrimSpace(create.Title) == "" {
		create.Title = "Untitled Whiteboard"
	}
	if create.RowStatus == "" {
		create.RowStatus = Normal
	}
	if create.RowStatus != Normal && create.RowStatus != Archived {
		return nil, errors.New("invalid whiteboard state")
	}
	if len(create.Document) == 0 {
		create.Document = json.RawMessage(`{}`)
	}
	if err := ValidateWhiteboardDocument(create.Document); err != nil {
		return nil, err
	}
	create.Tags = NormalizeWhiteboardTags(create.Tags)
	if create.CreatedTs == 0 {
		create.CreatedTs = time.Now().Unix()
	}
	if create.UpdatedTs == 0 {
		create.UpdatedTs = create.CreatedTs
	}
	return s.driver.CreateWhiteboard(ctx, create)
}

// ListWhiteboards returns boards matching the explicit store predicates.
func (s *Store) ListWhiteboards(ctx context.Context, find *FindWhiteboard) ([]*Whiteboard, error) {
	return s.driver.ListWhiteboards(ctx, find)
}

// GetWhiteboard returns the first matching board, or nil if none exists.
func (s *Store) GetWhiteboard(ctx context.Context, find *FindWhiteboard) (*Whiteboard, error) {
	list, err := s.ListWhiteboards(ctx, find)
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return list[0], nil
}

// UpdateWhiteboard validates and applies a partial mutation.
func (s *Store) UpdateWhiteboard(ctx context.Context, update *UpdateWhiteboard) error {
	if update == nil || update.ID <= 0 {
		return errors.New("whiteboard ID required")
	}
	if update.RowStatus != nil && *update.RowStatus != Normal && *update.RowStatus != Archived {
		return errors.New("invalid whiteboard state")
	}
	if update.Document != nil {
		if err := ValidateWhiteboardDocument(*update.Document); err != nil {
			return err
		}
	}
	if update.Tags != nil {
		tags := NormalizeWhiteboardTags(*update.Tags)
		update.Tags = &tags
	}
	if update.Title != nil && strings.TrimSpace(*update.Title) == "" {
		return errors.New("whiteboard title must not be blank")
	}
	if update.ClearThumbnail && update.ThumbnailAttachmentID != nil {
		return errors.New("conflicting thumbnail update")
	}
	if update.UpdatedTs == nil {
		now := time.Now().Unix()
		update.UpdatedTs = &now
	}
	return s.driver.UpdateWhiteboard(ctx, update)
}

// DeleteWhiteboard permanently removes one board without removing attachments.
func (s *Store) DeleteWhiteboard(ctx context.Context, delete *DeleteWhiteboard) error {
	return s.driver.DeleteWhiteboard(ctx, delete)
}
