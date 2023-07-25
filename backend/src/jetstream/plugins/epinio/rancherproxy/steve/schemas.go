package steve

import (
	"fmt"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/epinio/ui-backend/src/jetstream/plugins/epinio/rancherproxy/interfaces"
)

func NewDefaultSchemas(ec echo.Context) *interfaces.Collection {
	col := interfaces.Collection{
		Type:         interfaces.CollectionType,
		ResourceType: interfaces.SettingsResourceType,
		Actions:      make(map[string]string),
		Links:        make(map[string]string),
	}

	col.Links["self"] = interfaces.GetSelfLink(ec)

	baseURL := interfaces.GetSelfLink(ec)

	col.Data = make([]interface{}, 1)
	col.Data[0] = NewSchema(baseURL, "management.cattle.io.setting")

	return &col
}

func NewSchema(baseURL, id string) *interfaces.Schema {

	setting := interfaces.Schema{}
	setting.ID = id
	setting.Type = interfaces.SchemaType
	setting.Links = make(map[string]string)
	setting.Links["self"] = fmt.Sprintf("%s/%s", baseURL, id)
	setting.Links["collection"] = strings.Replace(setting.Links["self"], "v1/schemas/", "v1/", 1)
	setting.PluralName = id + "s"
	setting.ResourceMethods = []string{}
	setting.ResourceFields = make(map[string]interface{})
	setting.CollectionMethods = []string{"GET"}
	setting.Attributes = make(map[string]interface{})

	return &setting
}
