package rancherproxy

type LoginErrorRes struct {
	BasetType string `json:"baseType"`
	Status    int64  `json:"status"`
	Message   string `json:"message"`
	Code      string `json:"code"`
	Type      string `json:"type"`
}

type LoginParams struct {
	Description  string `json:"description"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	ResponseType string `json:"responseType"`
}

type LoginOIDCParams struct {
	Code         string `json:"code"`
	CodeVerifier string `json:"code_verifier"`
}
