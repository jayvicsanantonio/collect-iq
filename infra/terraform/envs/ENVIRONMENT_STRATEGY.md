# Environment Strategy

## Single Environment Approach

CollectIQ uses a **single environment strategy** optimized for the hackathon phase of the project.

## Rationale

### Why Single Environment?

1. **Cost Optimization**: Running multiple environments (dev, staging, prod) increases AWS costs significantly
2. **Simplicity**: Reduces complexity in infrastructure management and deployment
3. **Hackathon Focus**: Optimized for rapid development and demonstration
4. **Resource Efficiency**: All resources consolidated in one environment
5. **Faster Iteration**: No need to promote changes across multiple environments

### Hackathon Environment Characteristics

- **Purpose**: Development, testing, and demonstration
- **Budget**: $50/month AWS spend limit
- **Scaling**: On-demand billing for cost efficiency
- **Domain**: Amplify default domain (no custom domain costs)
- **Lambda Memory**: 512MB (lightweight), 1024MB (heavy processing)
- **Logging**: Info level (balanced between debugging and cost)
- **State Management**: Single Terraform state file in S3

## Environment Configuration

### Resource Naming

All resources use the prefix: `collectiq-hackathon-`

Examples:

- DynamoDB table: `collectiq-hackathon-cards`
- S3 bucket: `collectiq-hackathon-uploads`
- Lambda functions: `collectiq-hackathon-ingestion-handler`
- API Gateway: `collectiq-hackathon-api`

### Tagging Strategy

All resources are tagged with:

```hcl
{
  Project     = "CollectIQ"
  Environment = "hackathon"
  Owner       = "DevOps"
  ManagedBy   = "Terraform"
  CostCenter  = "Engineering"
}
```

### State Management

- **S3 Bucket**: `collectiq-tfstate`
- **State File**: `hackathon/terraform.tfstate`
- **Lock Table**: `collectiq-terraform-locks`
- **Encryption**: AES-256
- **Versioning**: Enabled for rollback capability

## Future Considerations

### When to Add More Environments

Consider adding additional environments when:

1. **Production Launch**: Need stable production environment separate from development
2. **Team Growth**: Multiple developers need isolated testing environments
3. **Compliance**: Regulatory requirements mandate environment separation
4. **Customer Data**: Real user data requires production isolation
5. **Budget Increase**: Sufficient budget to support multiple environments

### Migration Path

If additional environments are needed:

1. Copy `envs/hackathon/` to `envs/prod/`
2. Update `environment` variable to `prod`
3. Adjust resource sizing (increase Lambda memory, DynamoDB capacity)
4. Configure custom domain
5. Enable additional security features (MFA, WAF, GuardDuty)
6. Set up separate state file: `prod/terraform.tfstate`
7. Implement CI/CD approval gates for production

### Multi-Environment Structure (Future)

```
envs/
├── hackathon/     # Development and testing
├── staging/       # Pre-production validation (optional)
└── prod/          # Production environment
```

## Cost Comparison

### Single Environment (Current)

- **Monthly Cost**: ~$50
- **Resources**: 1x of each service
- **Complexity**: Low
- **Management**: Simple

### Multi-Environment (Future)

- **Monthly Cost**: ~$150-300
- **Resources**: 2-3x of each service
- **Complexity**: Medium-High
- **Management**: Requires CI/CD automation

## Best Practices for Single Environment

1. **Use Feature Flags**: Toggle features without redeployment
2. **Implement Rollback**: Leverage Terraform state versioning
3. **Monitor Costs**: AWS Budget alerts at $50/month
4. **Test Thoroughly**: No separate staging environment
5. **Backup Data**: Regular DynamoDB backups
6. **Version Control**: All infrastructure changes in Git
7. **Document Changes**: Clear commit messages and PR descriptions
8. **Gradual Rollout**: Deploy changes incrementally

## Testing Strategy

Without separate environments, testing is critical:

1. **Local Testing**: Test Lambda functions locally with SAM or LocalStack
2. **Unit Tests**: Comprehensive unit test coverage
3. **Integration Tests**: Test AWS service integrations
4. **Smoke Tests**: Quick validation after deployment
5. **Rollback Plan**: Always have a rollback strategy
6. **Monitoring**: CloudWatch alarms for critical metrics

## Deployment Strategy

### Safe Deployment Practices

1. **Terraform Plan**: Always review plan before apply
2. **Incremental Changes**: Deploy one module at a time
3. **Validation**: Run `terraform validate` before apply
4. **State Backup**: Backup state before major changes
5. **Off-Peak Deployment**: Deploy during low-usage periods
6. **Health Checks**: Verify services after deployment

### Rollback Procedure

```bash
# List state versions
aws s3api list-object-versions \
  --bucket collectiq-tfstate \
  --prefix hackathon/terraform.tfstate

# Download previous version
aws s3api get-object \
  --bucket collectiq-tfstate \
  --key hackathon/terraform.tfstate \
  --version-id <VERSION_ID> \
  terraform.tfstate.backup

# Restore state
terraform state push terraform.tfstate.backup

# Apply previous configuration
git checkout <previous-commit>
terraform apply
```

## Security Considerations

Single environment security measures:

1. **IAM Least Privilege**: Minimal permissions for all roles
2. **Encryption**: All data encrypted at rest and in transit
3. **VPC**: Lambda functions in VPC (if needed)
4. **Secrets Management**: AWS Secrets Manager for API keys
5. **CloudTrail**: Audit logging enabled
6. **Budget Alerts**: Prevent cost overruns
7. **Access Control**: Limited AWS account access

## Monitoring and Observability

Essential monitoring for single environment:

1. **CloudWatch Dashboards**: Key metrics visualization
2. **CloudWatch Alarms**: Alert on errors and high costs
3. **X-Ray Tracing**: Distributed tracing for debugging
4. **Log Aggregation**: Centralized logging
5. **Cost Explorer**: Daily cost monitoring
6. **Performance Metrics**: Lambda duration, API latency

## Conclusion

The single environment strategy is optimal for CollectIQ's hackathon phase, providing:

- ✅ Cost efficiency ($50/month budget)
- ✅ Simplified management
- ✅ Rapid iteration
- ✅ Sufficient for demonstration and testing

As the project matures and requirements evolve, additional environments can be added following the migration path outlined above.
