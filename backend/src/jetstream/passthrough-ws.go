package main

import (
	"crypto/tls"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"time"

	"net/http/httputil"

	"github.com/labstack/echo/v4"
	"github.com/pkg/errors"
)

func (p *portalProxy) ProxyWebSocketRequest(c echo.Context) error {
	cnsiURL, skipSllValidation, err := p.createURL(c)
	if err != nil {
		return errors.Wrap(err, "error creating CNSI url")
	}

	transport := http.DefaultTransport.(interface {
		Clone() *http.Transport
	}).Clone()

	// Force http/1.1
	// See here for details: https://github.com/epinio/epinio/issues/1396
	transport.TLSNextProto = map[string]func(authority string, c *tls.Conn) http.RoundTripper{}
	transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: skipSllValidation}

	proxy := httputil.ReverseProxy{
		Director: func(req *http.Request) {
			req.URL = cnsiURL
			req.Host = cnsiURL.Host
			req.Header.Del("origin") // (if enabled) cors has already been validated

			// Reverse proxy doesn't understand "ws...""
			if p.Config.HTTPS {
				req.URL.Scheme = "https"
			} else {
				req.URL.Scheme = "http"
			}

		},
		Transport:     transport,
		FlushInterval: time.Millisecond * 100,
	}

	proxy.ServeHTTP(c.Response().Writer, c.Request())

	return nil
}

func (p *portalProxy) createURL(c echo.Context) (*url.URL, bool, error) {
	var err error
	uri := url.URL{}

	cnsi := c.Param("uuid")

	// Ensure we don't escape parameters again
	uri.RawPath = c.Param("*")
	uri.Path, err = url.PathUnescape(uri.RawPath)
	if err != nil {
		return nil, false, errors.Wrap(err, "error unescaping path")
	}

	uri.RawQuery = c.Request().URL.RawQuery

	cnsiRec, err := p.GetCNSIRecord(cnsi) // TODO: RC AUTH - user should be connected in order to use?
	if err != nil {
		return nil, false, errors.Wrap(err, "error getting CNSI record")
	}

	cnsiURL, err := url.Parse(cnsiRec.DopplerLoggingEndpoint)
	if err != nil {
		return nil, false, errors.Wrap(err, "error parsing Doppler logging endpoint")
	}

	// The APIEndpoint might have a path already - so join the request URI to it...
	// but ensure we don't escape parameters again
	extraPath := uri.Path
	if len(uri.RawPath) > 0 {
		extraPath = uri.RawPath
	}
	cnsiURL.RawPath = path.Join(uri.Path, extraPath)
	cnsiURL.RawQuery = uri.RawQuery

	cnsiURL.Path, err = url.PathUnescape(uri.RawPath)
	if err != nil {
		return nil, false, errors.Wrap(err, "error unescaping path again")
	}
	cnsiURL.Path = fmt.Sprintf("/%s", cnsiURL.Path) // Add a leading slash to the Path (needed)

	return cnsiURL, cnsiRec.SkipSSLValidation, nil
}
