package epinio_utils

import (
	"encoding/json"
	"fmt"

	eInterfaces "github.com/epinio/ui-backend/src/jetstream/plugins/epinio/interfaces"
	jInterfaces "github.com/epinio/ui-backend/src/jetstream/repository/interfaces"

	log "github.com/sirupsen/logrus"
)

func FindEpinioEndpoint(p jInterfaces.PortalProxy) (*jInterfaces.CNSIRecord, error) {
	endpoints, err := p.ListEndpoints()
	if err != nil {
		msg := "failed to fetch list of endpoints: %+v"
		log.Errorf(msg, err)
		return nil, fmt.Errorf(msg, err)
	}

	for _, e := range endpoints {
		if e.CNSIType == eInterfaces.EndpointType {
			return e, nil
		}
	}

	msg := "failed to find an epinio endpoint"
	log.Error(msg)
	return nil, fmt.Errorf(msg)
}

func GetMetadata(record *jInterfaces.CNSIRecord) (eInterfaces.CNSIMetadata, error) {
	var metadata eInterfaces.CNSIMetadata

	err := json.Unmarshal([]byte(record.Metadata), &metadata)
	if err != nil {
		log.Errorf("error unmarshalling metadata [%s]: %s", record.Metadata, err.Error())
	}

	return metadata, nil
}
