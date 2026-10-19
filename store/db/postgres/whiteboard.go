package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/pkg/errors"

	"github.com/usememos/memos/filter"
	"github.com/usememos/memos/store"
)

func (d *DB) CreateWhiteboard(ctx context.Context, create *store.Whiteboard) (*store.Whiteboard, error) {
	payload, err := json.Marshal(store.WhiteboardPayload{Tags: create.Tags})
	if err != nil {
		return nil, err
	}
	err = d.db.QueryRowContext(ctx, `INSERT INTO whiteboard
		(uid, creator_id, row_status, created_ts, updated_ts, title, payload, document, thumbnail_attachment_id, background_layout)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
		create.UID, create.CreatorID, create.RowStatus, create.CreatedTs, create.UpdatedTs,
		create.Title, string(payload), string(create.Document), create.ThumbnailAttachmentID, create.BackgroundLayout).Scan(&create.ID)
	if err != nil {
		return nil, errors.Wrap(err, "failed to create whiteboard")
	}
	return create, nil
}

func (d *DB) ListWhiteboards(ctx context.Context, find *store.FindWhiteboard) ([]*store.Whiteboard, error) {
	where, args := []string{"1 = 1"}, []any{}
	if find.ID != nil {
		where, args = append(where, "whiteboard.id = "+placeholder(len(args)+1)), append(args, *find.ID)
	}
	if find.UID != nil {
		where, args = append(where, "whiteboard.uid = "+placeholder(len(args)+1)), append(args, *find.UID)
	}
	if find.CreatorID != nil {
		where, args = append(where, "whiteboard.creator_id = "+placeholder(len(args)+1)), append(args, *find.CreatorID)
	}
	if find.RowStatus != nil {
		where, args = append(where, "whiteboard.row_status = "+placeholder(len(args)+1)), append(args, *find.RowStatus)
	}
	engine, err := filter.NewEngine(filter.NewWhiteboardSchema())
	if err != nil {
		return nil, err
	}
	if err := filter.AppendConditions(ctx, engine, find.Filters, filter.DialectPostgres, &where, &args); err != nil {
		return nil, err
	}
	order, err := store.WhiteboardOrderSQL(find.OrderBy)
	if err != nil {
		return nil, err
	}
	document := "document"
	if find.ExcludeDocument {
		document = "'{}'"
	}
	query := `SELECT id, uid, creator_id, row_status, created_ts, updated_ts, title, payload, `+document+`, thumbnail_attachment_id, background_layout
		FROM whiteboard WHERE `+strings.Join(where, " AND ")+" ORDER BY "+order
	if find.Limit != nil {
		query, args = query+" LIMIT "+placeholder(len(args)+1), append(args, *find.Limit)
	}
	if find.Offset != nil {
		query, args = query+" OFFSET "+placeholder(len(args)+1), append(args, *find.Offset)
	}
	rows, err := d.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, errors.Wrap(err, "failed to list whiteboards")
	}
	defer rows.Close()
	result := []*store.Whiteboard{}
	for rows.Next() {
		board := &store.Whiteboard{}
		var payload, document string
		var thumbnail sql.NullInt64
		if err := rows.Scan(&board.ID, &board.UID, &board.CreatorID, &board.RowStatus, &board.CreatedTs,
			&board.UpdatedTs, &board.Title, &payload, &document, &thumbnail, &board.BackgroundLayout); err != nil {
			return nil, err
		}
		var metadata store.WhiteboardPayload
		if err := json.Unmarshal([]byte(payload), &metadata); err != nil {
			return nil, errors.Wrap(err, "invalid whiteboard payload")
		}
		board.Tags, board.Document = metadata.Tags, json.RawMessage(document)
		board.ThumbnailAttachmentID = store.NullInt32Pointer(thumbnail)
		result = append(result, board)
	}
	return result, rows.Err()
}

func (d *DB) UpdateWhiteboard(ctx context.Context, update *store.UpdateWhiteboard) error {
	set, args := []string{}, []any{}
	if update.BackgroundLayout != nil {
		set, args = append(set, "background_layout = "+placeholder(len(args)+1)), append(args, *update.BackgroundLayout)
	}
	if update.Title != nil {
		set, args = append(set, "title = "+placeholder(len(args)+1)), append(args, *update.Title)
	}
	if update.Tags != nil {
		payload, err := json.Marshal(store.WhiteboardPayload{Tags: *update.Tags})
		if err != nil {
			return err
		}
		set, args = append(set, "payload = "+placeholder(len(args)+1)), append(args, string(payload))
	}
	if update.Document != nil {
		set, args = append(set, "document = "+placeholder(len(args)+1)), append(args, string(*update.Document))
	}
	if update.RowStatus != nil {
		set, args = append(set, "row_status = "+placeholder(len(args)+1)), append(args, *update.RowStatus)
	}
	if update.UpdatedTs != nil {
		set, args = append(set, "updated_ts = "+placeholder(len(args)+1)), append(args, *update.UpdatedTs)
	}
	if update.ClearThumbnail {
		set = append(set, "thumbnail_attachment_id = NULL")
	} else if update.ThumbnailAttachmentID != nil {
		set, args = append(set, "thumbnail_attachment_id = "+placeholder(len(args)+1)), append(args, *update.ThumbnailAttachmentID)
	}
	if len(set) == 0 {
		return nil
	}
	query := "UPDATE whiteboard SET "+strings.Join(set, ", ")+" WHERE id = "+placeholder(len(args)+1)
	args = append(args, update.ID)
	_, err := d.db.ExecContext(ctx, query, args...)
	return errors.Wrap(err, "failed to update whiteboard")
}

func (d *DB) DeleteWhiteboard(ctx context.Context, delete *store.DeleteWhiteboard) error {
	_, err := d.db.ExecContext(ctx, "DELETE FROM whiteboard WHERE id = $1", delete.ID)
	return errors.Wrap(err, "failed to delete whiteboard")
}
