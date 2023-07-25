package interfaces

import (
	"fmt"
	"strings"

	"github.com/labstack/echo/v4"
)

const (
	CollectionType             = "collection"
	UserPreferenceResourceType = "userpreference"
	SettingsResourceType       = "management.cattle.io.setting"
	ClusterResourceType        = "management.cattle.io.cluster"
	AuthProviderResourceType   = "authProvider"
	UserResourceType           = "user"
	PrincipalResourceType      = "principal"
	SchemaType                 = "schema"
)

func NewCollection(typ string) *Collection {
	col := Collection{
		Type:         CollectionType,
		ResourceType: UserPreferenceResourceType,
		Actions:      make(map[string]string),
		Links:        make(map[string]string),
	}

	return &col
}

func GetBaseURL(ec echo.Context) string {
	host := ec.Request().Header.Get("X-Api-Host")
	if len(host) == 0 {
		host = ec.Request().Host
	}

	return host
}

func GetSelfLink(ec echo.Context, paths ...string) string {
	host := GetBaseURL(ec)
	path := strings.Join(paths, "/")
	if len(path) > 0 {
		path = fmt.Sprintf("/%s", path)
	}

	return fmt.Sprintf("https://%s%s%s", host, ec.Request().URL.String(), path)
}

type AuthProvider struct {
	ID          string            `json:"id"`
	Type        string            `json:"type"`
	Actions     map[string]string `json:"actions"`
	Links       map[string]string `json:"links"`
	BaseType    string            `json:"baseType"`
	RedirectUrl string            `json:"redirectUrl"`
}

type Collection struct {
	Type         string            `json:"type"`
	Data         []interface{}     `json:"data"`
	ResourceType string            `json:"resourceType"`
	Actions      map[string]string `json:"actions"`
	Links        map[string]string `json:"links"`
	Revision     string            `json:"revision,omitempty"`
}

type UserPref struct {
	Type  string            `json:"type"`
	Data  interface{}       `json:"data"`
	ID    string            `json:"id"`
	Links map[string]string `json:"links"`
}

type Metadata struct {
	Name string `json:"name"`
}

type APIData struct {
	APIVersion string            `json:"apiVersion"`
	Kind       string            `json:"kind"`
	Type       string            `json:"type"`
	ID         string            `json:"id"`
	Links      map[string]string `json:"links"`
	Metadata   Metadata          `json:"metadata,omitempty"`
}

type Setting struct {
	APIData
	Default    string `json:"default"`
	Value      string `json:"value"`
	Source     string `json:"source"`
	Customized bool   `json:"customized"`
}

type Schema struct {
	ID                string                 `json:"id"`
	Type              string                 `json:"type"`
	Links             map[string]string      `json:"links"`
	PluralName        string                 `json:"pluralName"`
	ResourceMethods   []string               `json:"resourceMethods"`
	ResourceFields    map[string]interface{} `json:"resourceFields"`
	CollectionMethods []string               `json:"collectionMethods"`
	Attributes        map[string]interface{} `json:"attributes"`
}

type Error struct {
	Message string `json:"message"`
	Status  string `json:"status"`
	Type    string `json:"type"`
}

type User struct {
	Name               string            `json:"name"`
	ID                 string            `json:"id"`
	Username           string            `json:"username"`
	Description        string            `json:"description"`
	UUID               string            `json:"uuid"`
	BaseType           string            `json:"baseType"`
	Type               string            `json:"type"`
	Actions            map[string]string `json:"actions"`
	Links              map[string]string `json:"links"`
	State              string            `json:"state"`
	MustChangePassword bool              `json:"mustChangePassword"`
	Me                 bool              `json:"me"`
	Enabled            bool              `json:"enabled"`
	PrinicpalIDs       []string          `json:"principalIds"`
}

type Principal struct {
	Name          string            `json:"name"`
	ID            string            `json:"id"`
	LoginName     string            `json:"loginName"`
	BaseType      string            `json:"baseType"`
	Type          string            `json:"type"`
	Data          []interface{}     `json:"data"`
	Actions       map[string]string `json:"actions"`
	Links         map[string]string `json:"links"`
	MemberOf      bool              `json:"mustChangePassword"`
	Me            bool              `json:"me"`
	Provider      string            `json:"provider"`
	PrincipalType string            `json:"principalType"`
}

type Cluster struct {
	APIData
	Actions map[string]string      `json:"actions"`
	Spec    map[string]interface{} `json:"spec"`
	Status  map[string]interface{} `json:"status"`
}
