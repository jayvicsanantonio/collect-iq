/**
 * Lambda Layer for Sharp Image Processing Library
 * Provides sharp compiled for Amazon Linux 2 (Lambda runtime)
 */

resource "null_resource" "sharp_layer" {
  triggers = {
    # Rebuild if sharp version changes
    sharp_version = var.sharp_version
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      echo "Building sharp layer for Lambda..."
      
      # Create temporary directory
      LAYER_DIR=$(mktemp -d)
      mkdir -p $LAYER_DIR/nodejs/node_modules
      
      # Install sharp for Lambda (Amazon Linux 2)
      cd $LAYER_DIR/nodejs
      npm init -y
      npm install --arch=x64 --platform=linux sharp@${var.sharp_version}
      
      # Create zip
      cd $LAYER_DIR
      zip -r ${var.output_path} nodejs/
      
      # Cleanup
      rm -rf $LAYER_DIR
      
      echo "Sharp layer built successfully at ${var.output_path}"
    EOT
  }
}

resource "aws_lambda_layer_version" "sharp" {
  filename            = var.output_path
  layer_name          = var.layer_name
  description         = "Sharp ${var.sharp_version} image processing library for Lambda"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]
  
  source_code_hash = filebase64sha256(var.output_path)

  depends_on = [null_resource.sharp_layer]
}
