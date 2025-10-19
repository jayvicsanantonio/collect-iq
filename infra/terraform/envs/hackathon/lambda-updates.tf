# Lambda Environment Variable Updates
# This file handles updating Lambda environment variables that depend on
# resources created after the initial Lambda deployment

# Note: To update the cards_revalue Lambda with the Step Functions ARN,
# you need to manually update the lambdas.tf file after Step Functions is deployed.
#
# Change this line in lambdas.tf:
#   STEP_FUNCTIONS_ARN   = "" # Will be added when Step Functions is deployed
#
# To:
#   STEP_FUNCTIONS_ARN   = try(module.step_functions.state_machine_arn, "")
#
# Then run: terraform apply
#
# The try() function allows Terraform to create the Lambda first, then update it
# after Step Functions is created.

# ============================================================================
# Alternative: Manual Update via AWS CLI
# ============================================================================

# After deploying Step Functions, you can manually update the Lambda:
#
# aws lambda update-function-configuration \
#   --function-name collectiq-hackathon-cards-revalue \
#   --environment "Variables={AWS_REGION=us-east-1,STEP_FUNCTIONS_ARN=$(terraform output -raw step_functions_state_machine_arn),DDB_TABLE=collectiq-hackathon-cards}" \
#   --region us-east-1
