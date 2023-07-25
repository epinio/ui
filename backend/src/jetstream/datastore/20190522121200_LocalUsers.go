package datastore

import (
	"database/sql"
	"strings"

	"bitbucket.org/liamstask/goose/lib/goose"
)

// NOTE: This migration script has been modified
// We originally had a triiger, which is removed in a later migration script
// This requires a certain level of privilege to create, so it has been removed in this scipt for new installs.
// Upgrades will still remove the trigger if it exists

func init() {
	RegisterMigration(20190522121200, "LocalUsers", func(txn *sql.Tx, conf *goose.DBConf) error {
		binaryDataType := "BYTEA"
		if strings.Contains(conf.Driver.Name, "mysql") {
			binaryDataType = "BLOB"
		}

		//Add auth_endpoint_type to console_config table - allows ability to enable local users.
		addColumn := "ALTER TABLE console_config ADD auth_endpoint_type VARCHAR(255);"
		_, err := txn.Exec(addColumn)
		if err != nil {
			return err
		}

		createLocalUsers := "CREATE TABLE IF NOT EXISTS local_users ("
		createLocalUsers += "user_guid     VARCHAR(36) UNIQUE NOT NULL, "
		createLocalUsers += "password_hash " + binaryDataType + "       NOT NULL, "
		createLocalUsers += "user_name     VARCHAR(128)  UNIQUE NOT NULL, "
		createLocalUsers += "user_email    VARCHAR(254), "
		createLocalUsers += "user_scope    VARCHAR(64), "
		createLocalUsers += "last_login    TIMESTAMP, "
		createLocalUsers += "last_updated  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, "
		createLocalUsers += "PRIMARY KEY (user_guid) )"

		//Configure Postgres migration options
		if strings.Contains(conf.Driver.Name, "postgres") {
			createLocalUsers += " WITH (OIDS=FALSE);"
		} else {
			createLocalUsers += ";"
		}

		_, err = txn.Exec(createLocalUsers)
		if err != nil {
			return err
		}

		createIndex := "CREATE INDEX local_users_user_guid ON local_users (user_guid);"
		_, err = txn.Exec(createIndex)
		if err != nil {
			return err
		}
		createIndex = "CREATE INDEX local_users_user_name ON local_users (user_name);"
		_, err = txn.Exec(createIndex)
		if err != nil {
			return err
		}

		return nil
	})
}
