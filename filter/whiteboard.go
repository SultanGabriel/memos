package filter

import "github.com/google/cel-go/cel"

// NewWhiteboardSchema exposes independent whiteboard metadata to the CEL engine.
func NewWhiteboardSchema() Schema {
	return Schema{
		Name: "whiteboard",
		Fields: map[string]Field{
			"title": {
				Name: "title", Kind: FieldKindScalar, Type: FieldTypeString,
				Column: Column{Table: "whiteboard", Name: "title"}, SupportsContains: true,
			},
			"tags": {
				Name: "tags", Kind: FieldKindJSONList, Type: FieldTypeString,
				Column: Column{Table: "whiteboard", Name: "payload"}, JSONPath: []string{"tags"},
			},
		},
		EnvOptions: []cel.EnvOption{
			cel.Variable("title", cel.StringType),
			cel.Variable("tags", cel.ListType(cel.StringType)),
			cel.ASTValidators(cel.ValidateRegexLiterals()),
		},
	}
}
