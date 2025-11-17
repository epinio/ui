package interfaces

const (
	EndpointType = "epinio"
)

type CNSIMetadata struct {
	UIURL      string `json:"ui_url"`
	DexAuthUrl string `json:"dex_auth_url"`
	DexIssuer  string `json:"dex_issuer"`
}
