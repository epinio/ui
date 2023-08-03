package datastore

import (
	"database/sql"

	"bitbucket.org/liamstask/goose/lib/goose"
)

func init() {
	RegisterMigration(20190621212700, "ConfigSchema", func(txn *sql.Tx, conf *goose.DBConf) error {
		configTable := "CREATE TABLE IF NOT EXISTS config ("
		configTable += "  groupName         VARCHAR(255)              NOT NULL, "
		configTable += "  name              VARCHAR(255)              NOT NULL, "
		configTable += "  value       			VARCHAR(255)              NOT NULL,"
		configTable += "  last_updated      TIMESTAMP                 NOT NULL DEFAULT CURRENT_TIMESTAMP);"

		_, err := txn.Exec(configTable)
		if err != nil {
			return err
		}

		// Add a marker to the new table so that later we know we need to migrate the old data to the new table
		addMarker := "INSERT INTO config (groupName, name, value) VALUES ('system', '__CONFIG_MIGRATION_NEEDED', 'true')"

		_, err = txn.Exec(addMarker)
		if err != nil {
			return err
		}

		return nil
	})
}
