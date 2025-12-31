package api

import (
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"

	"github.com/labstack/echo/v4"
	log "github.com/sirupsen/logrus"
)

type InstallRequest struct {
	Domain          string `json:"domain"`
	SkipCertManager bool   `json:"skipCertManager"`
	SkipIngress     bool   `json:"skipIngress"`
	ClusterId       string `json:"clusterId"`
}

type InstallResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Error   string `json:"error,omitempty"`
}

// InstallEpinio handles the installation of Epinio on a cluster
func InstallEpinio(ec echo.Context) error {
	var req InstallRequest
	if err := ec.Bind(&req); err != nil {
		return SendErrorResponse(ec, fmt.Sprintf("Invalid request: %v", err))
	}

	if req.Domain == "" {
		return SendErrorResponse(ec, "Domain is required")
	}

	log.Infof("Installing Epinio with domain: %s, skipCertManager: %v, skipIngress: %v", 
		req.Domain, req.SkipCertManager, req.SkipIngress)

	// Check prerequisites
	if err := checkPrerequisites(); err != nil {
		return SendErrorResponse(ec, fmt.Sprintf("Prerequisites check failed: %v", err))
	}

	// Install cert-manager if needed
	if !req.SkipCertManager {
		if err := installCertManager(); err != nil {
			return SendErrorResponse(ec, fmt.Sprintf("Failed to install cert-manager: %v", err))
		}
	}

	// Install ingress controller if needed
	if !req.SkipIngress {
		if err := installIngressController(); err != nil {
			return SendErrorResponse(ec, fmt.Sprintf("Failed to install ingress controller: %v", err))
		}
	}

	// Install Epinio
	if err := installEpinio(req.Domain); err != nil {
		return SendErrorResponse(ec, fmt.Sprintf("Failed to install Epinio: %v", err))
	}

	response := InstallResponse{
		Success: true,
		Message: "Epinio installed successfully",
	}

	return SendResponse(ec, response)
}

func checkPrerequisites() error {
	// Check kubectl
	if _, err := exec.LookPath("kubectl"); err != nil {
		return fmt.Errorf("kubectl is not installed or not in PATH")
	}

	// Check helm
	if _, err := exec.LookPath("helm"); err != nil {
		return fmt.Errorf("helm is not installed or not in PATH")
	}

	// Check if we can connect to a cluster
	cmd := exec.Command("kubectl", "cluster-info")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("cannot connect to Kubernetes cluster")
	}

	return nil
}

func installCertManager() error {
	// Check if cert-manager is already installed
	cmd := exec.Command("kubectl", "get", "namespace", "cert-manager")
	if err := cmd.Run(); err == nil {
		// Namespace exists, check if cert-manager is actually installed
		cmd = exec.Command("kubectl", "get", "deployment", "-n", "cert-manager", "cert-manager")
		if err := cmd.Run(); err == nil {
			log.Info("cert-manager is already installed, skipping...")
			return nil
		}
	}

	log.Info("Installing cert-manager...")

	// Add cert-manager repo
	cmd = exec.Command("helm", "repo", "add", "jetstack", "https://charts.jetstack.io")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to add cert-manager helm repo: %v", err)
	}

	// Update helm repos
	cmd = exec.Command("helm", "repo", "update")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to update helm repos: %v", err)
	}

	// Install cert-manager
	cmd = exec.Command("helm", "upgrade", "--install", "cert-manager", "jetstack/cert-manager",
		"--namespace", "cert-manager",
		"--create-namespace",
		"--set", "crds.enabled=true",
		"--set", "crds.keep=false",
		"--set", "extraArgs[0]=--enable-certificate-owner-ref=true",
		"--version", "1.18.1",
		"--wait")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to install cert-manager: %v", err)
	}

	log.Info("cert-manager installed successfully")
	return nil
}

func installIngressController() error {
	// Check if ingress-nginx is already installed
	cmd := exec.Command("kubectl", "get", "namespace", "ingress-nginx")
	if err := cmd.Run(); err == nil {
		// Namespace exists, check if ingress-nginx is actually installed
		cmd = exec.Command("kubectl", "get", "deployment", "-n", "ingress-nginx", "ingress-nginx-controller")
		if err := cmd.Run(); err == nil {
			log.Info("ingress-nginx is already installed, skipping...")
			return nil
		}
	}

	log.Info("Installing ingress-nginx...")

	// Add ingress-nginx repo
	cmd := exec.Command("helm", "repo", "add", "ingress-nginx", "https://kubernetes.github.io/ingress-nginx")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to add ingress-nginx helm repo: %v", err)
	}

	// Update helm repos
	cmd = exec.Command("helm", "repo", "update")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to update helm repos: %v", err)
	}

	// Install ingress-nginx
	cmd = exec.Command("helm", "upgrade", "--install", "ingress-nginx", "ingress-nginx/ingress-nginx",
		"--namespace", "ingress-nginx",
		"--create-namespace",
		"--set", "controller.ingressClassResource.default=true",
		"--set", "controller.admissionWebhooks.enabled=false",
		"--wait")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to install ingress-nginx: %v", err)
	}

	log.Info("ingress-nginx installed successfully")
	return nil
}

func installEpinio(domain string) error {
	log.Infof("Installing Epinio with domain: %s", domain)

	// Add epinio repo
	cmd := exec.Command("helm", "repo", "add", "epinio", "https://epinio.github.io/helm-charts")
	err := cmd.Run()
	if err != nil {
		// If repo already exists, that's fine
		output, _ := cmd.CombinedOutput()
		if !strings.Contains(string(output), "already exists") {
			return fmt.Errorf("failed to add epinio helm repo: %v", err)
		}
	}

	// Update helm repos
	cmd = exec.Command("helm", "repo", "update")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to update helm repos: %v", err)
	}

	// Install Epinio
	cmd = exec.Command("helm", "upgrade", "--install", "epinio", "epinio/epinio",
		"--namespace", "epinio",
		"--create-namespace",
		"--set", fmt.Sprintf("global.domain=%s", domain),
		"--wait")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("failed to install Epinio: %v", err)
	}

	log.Info("Epinio installed successfully")
	return nil
}

func SendErrorResponse(ec echo.Context, errorMsg string) error {
	response := InstallResponse{
		Success: false,
		Error:   errorMsg,
	}

	jsonString, err := json.Marshal(response)
	if err != nil {
		return err
	}

	ec.Response().Header().Set("Content-Type", "application/json")
	ec.Response().Status = 400
	ec.Response().Write([]byte(jsonString))

	return nil
}

