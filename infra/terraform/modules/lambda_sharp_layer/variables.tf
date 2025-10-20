variable "layer_name" {
  description = "Name of the Lambda layer"
  type        = string
  default     = "sharp-image-processing"
}

variable "sharp_version" {
  description = "Version of sharp to install"
  type        = string
  default     = "0.34.4"
}

variable "output_path" {
  description = "Path where the layer zip will be created"
  type        = string
}
