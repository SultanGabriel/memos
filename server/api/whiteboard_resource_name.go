package api

// ExtractWhiteboardUIDFromName returns the public UID from a whiteboard resource name.
func ExtractWhiteboardUIDFromName(name string) (string, error) {
	tokens, err := GetNameParentTokens(name, "whiteboards/")
	if err != nil {
		return "", err
	}
	return tokens[0], nil
}
