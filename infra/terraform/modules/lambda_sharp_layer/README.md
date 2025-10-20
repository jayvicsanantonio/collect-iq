# Lambda Sharp Layer Module

This module creates a Lambda Layer containing the `sharp` image processing library compiled for Amazon Linux 2 (Lambda runtime environment).

## Why This Module?

Sharp is a native Node.js module that requires platform-specific binaries. When deploying to Lambda, you need sharp compiled for Amazon Linux 2, not your local development machine.

## What It Does

1. Creates a temporary directory
2. Installs sharp with `--arch=x64 --platform=linux` flags
3. Packages it as a Lambda Layer
4. Makes it available to Lambda functions

## Usage

```hcl
module "lambda_sharp_layer" {
  source = "../../modules/lambda_sharp_layer"

  layer_name    = "my-sharp-layer"
  sharp_version = "0.34.4"
  output_path   = "${path.module}/.terraform/layers/sharp-layer.zip"
}

module "my_lambda" {
  source = "../../modules/lambda_fn"

  # ... other config ...

  layers = [module.lambda_sharp_layer.layer_arn]
}
```

## Requirements

- Node.js and npm must be installed on the machine running Terraform
- Sufficient disk space for temporary layer build (~50MB)

## Notes

- The layer is rebuilt whenever `sharp_version` changes
- Compatible with Node.js 18.x and 20.x runtimes
- The layer adds ~10MB to your Lambda deployment
