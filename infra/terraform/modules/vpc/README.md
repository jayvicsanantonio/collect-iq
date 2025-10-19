# VPC Module

Creates a VPC with public and private subnets across two availability zones for high availability.

## Architecture

- 1 VPC with configurable CIDR block (default: 10.0.0.0/16)
- 1 Internet Gateway for public internet access
- 1 NAT Gateway for private subnet outbound traffic
- Configurable number of public subnets (default: 2, auto-assign public IPs)
- Configurable number of private subnets (default: 2)
- 1 Public route table (routes to Internet Gateway)
- 1 Private route table (routes to NAT Gateway)

## Usage

```hcl
module "vpc" {
  source = "../../modules/vpc"

  project_name         = "collectiq"
  environment          = "hackathon"
  vpc_cidr             = "10.0.0.0/16"
  public_subnet_count  = 2
  private_subnet_count = 2
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| project_name | Name of the project | string | - | yes |
| environment | Environment name | string | - | yes |
| vpc_cidr | CIDR block for VPC | string | "10.0.0.0/16" | no |
| public_subnet_count | Number of public subnets to create | number | 2 | no |
| private_subnet_count | Number of private subnets to create | number | 2 | no |

## Outputs

| Name | Description |
|------|-------------|
| vpc_id | ID of the VPC |
| vpc_cidr | CIDR block of the VPC |
| public_subnet_ids | IDs of public subnets |
| private_subnet_ids | IDs of private subnets |
| internet_gateway_id | ID of the Internet Gateway |
| nat_gateway_id | ID of the NAT Gateway |
| public_route_table_id | ID of the public route table |
| private_route_table_id | ID of the private route table |

## Subnet CIDR Allocation

- Public Subnet 1: 10.0.0.0/20 (4,096 IPs)
- Public Subnet 2: 10.0.16.0/20 (4,096 IPs)
- Private Subnet 1: 10.0.32.0/20 (4,096 IPs)
- Private Subnet 2: 10.0.48.0/20 (4,096 IPs)

## Notes

- NAT Gateway is placed in the first public subnet
- Subnets are distributed across availability zones using modulo operation for high availability
- If subnet count exceeds available AZs, subnets will wrap around to reuse AZs
- DNS hostnames and DNS support are enabled for the VPC
- Private subnet CIDR blocks start after public subnet allocations to avoid overlap
