/**
 * Lambda Layer for Sharp Image Processing Library
 * Provides sharp compiled for Amazon Linux 2 (Lambda runtime)
 */

resource "null_resource" "sharp_layer" {
  triggers = {
    # Rebuild if sharp version changes
    sharp_version = var.sharp_version
    output_path   = var.output_path
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      echo "Building optimized sharp layer for Lambda..."
      
      # Create output directory if it doesn't exist
      mkdir -p $(dirname "${var.output_path}")
      
      # Create temporary directory
      LAYER_DIR=$(mktemp -d)
      mkdir -p $LAYER_DIR/nodejs
      
      # Install sharp for Lambda (Amazon Linux 2) with production-only dependencies
      cd $LAYER_DIR/nodejs
      npm init -y
      npm install --arch=x64 --platform=linux --production sharp@${var.sharp_version}
      
      # Remove unnecessary files to reduce size
      find . -name "*.md" -type f -delete
      find . -name "*.ts" -type f -delete
      find . -name "*.map" -type f -delete
      find . -name "test" -type d -exec rm -rf {} + 2>/dev/null || true
      find . -name "tests" -type d -exec rm -rf {} + 2>/dev/null || true
      find . -name "*.test.js" -type f -delete
      find . -name "*.spec.js" -type f -delete
      find . -name "example" -type d -exec rm -rf {} + 2>/dev/null || true
      find . -name "examples" -type d -exec rm -rf {} + 2>/dev/null || true
      find . -name "docs" -type d -exec rm -rf {} + 2>/dev/null || true
      
      # Create optimized zip (exclude .git, .github, etc.)
      cd $LAYER_DIR
      zip -r -q ${abspath(var.output_path)} nodejs/ -x "*.git*" "*.DS_Store"
      
      # Show size
      SIZE=$(du -h ${abspath(var.output_path)} | cut -f1)
      echo "Sharp layer built successfully: $SIZE at ${var.output_path}"
      
      # Cleanup
      rm -rf $LAYER_DIR
    EOT
  }
}

data "local_file" "sharp_layer_zip" {
  filename = var.output_path
  
  depends_on = [null_resource.sharp_layer]
}

resource "aws_lambda_layer_version" "sharp" {
  filename            = var.output_path
  layer_name          = var.layer_name
  description         = "Sharp ${var.sharp_version} image processing library for Lambda"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]
  
  source_code_hash = data.local_file.sharp_layer_zip.content_base64sha256

  depends_on = [null_resource.sharp_layer]
}
