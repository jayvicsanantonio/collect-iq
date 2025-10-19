# Amplify Hosting Module

Deploys a Next.js application to AWS Amplify with automatic builds and deployments.

## Prerequisites

### GitHub Personal Access Token

Amplify requires a GitHub personal access token to access your repository. Create one with the following steps:

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name (e.g., "Amplify CollectIQ")
4. Select the following scopes:
   - `repo` (Full control of private repositories)
   - `admin:repo_hook` (Full control of repository hooks)
5. Click "Generate token" and copy the token

### Setting the Token

**Option 1: Environment Variable (Recommended)**
```bash
export TF_VAR_github_access_token="ghp_your_token_here"
```

**Option 2: terraform.tfvars**
```hcl
github_access_token = "ghp_your_token_here"
```

**⚠️ Never commit the token to version control!**

## Usage

```hcl
module "amplify_hosting" {
  source = "../../modules/amplify_hosting"

  app_name     = "collectiq-hackathon-web"
  repository   = "https://github.com/your-org/collect-iq"
  access_token = var.github_access_token

  main_branch_name    = "main"
  enable_develop_branch = false

  enable_auto_branch_creation   = true
  auto_branch_creation_patterns = ["pr*"]

  environment_variables = {
    NEXT_PUBLIC_REGION = "us-east-1"
    NEXT_PUBLIC_API_BASE = "https://api.example.com"
  }

  build_spec = <<-EOT
    version: 1
    frontend:
      phases:
        preBuild:
          commands:
            - npm install -g pnpm@9
            - pnpm install
        build:
          commands:
            - pnpm run web:build
      artifacts:
        baseDirectory: apps/web/.next
        files:
          - '**/*'
      cache:
        paths:
          - node_modules/**/*
          - apps/web/node_modules/**/*
          - .pnpm-store/**/*
  EOT

  tags = {
    Environment = "hackathon"
    Project     = "CollectIQ"
  }
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| app_name | Name of the Amplify application | string | - | yes |
| repository | GitHub repository URL | string | - | yes |
| access_token | GitHub personal access token | string | "" | yes* |
| build_spec | Build specification for Next.js | string | - | yes |
| environment_variables | Environment variables for the app | map(string) | {} | no |
| main_branch_name | Name of the main branch | string | "main" | no |
| enable_develop_branch | Create a develop branch | bool | false | no |
| enable_auto_branch_creation | Enable PR preview branches | bool | true | no |
| custom_domain | Custom domain name | string | "" | no |

*Required for private repositories

## Outputs

| Name | Description |
|------|-------------|
| app_id | Amplify app ID |
| default_domain | Amplify default domain |
| main_branch_url | Main branch URL |

## Notes

- Uses `WEB_COMPUTE` platform for Next.js SSR/ISR support
- Automatic builds enabled for main branch
- PR preview branches created automatically
- Default domain: `https://main.{app-id}.amplifyapp.com`
