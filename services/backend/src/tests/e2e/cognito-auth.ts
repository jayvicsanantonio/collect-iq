/**
 * Cognito Authentication Utilities for E2E Tests
 *
 * Provides functions to authenticate test users and obtain JWT tokens
 * for use in E2E test scenarios.
 */

import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminCreateUserCommand,
  AdminSetUserPasswordCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
} from '@aws-sdk/client-cognito-identity-provider';

export interface CognitoTokens {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TestUser {
  email: string;
  password: string;
  sub?: string;
}

/**
 * Cognito client for test operations
 */
const cognitoClient = new CognitoIdentityProviderClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Authenticate a test user and obtain JWT tokens
 *
 * @param email - User email
 * @param password - User password
 * @returns JWT tokens (access, id, refresh)
 */
export async function authenticateTestUser(
  email: string,
  password: string,
): Promise<CognitoTokens> {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;
  const clientId = process.env.COGNITO_CLIENT_ID;

  if (!userPoolId || !clientId) {
    throw new Error('COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID must be set');
  }

  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const response = await cognitoClient.send(command);

    if (!response.AuthenticationResult) {
      throw new Error('Authentication failed: No tokens returned');
    }

    return {
      accessToken: response.AuthenticationResult.AccessToken!,
      idToken: response.AuthenticationResult.IdToken!,
      refreshToken: response.AuthenticationResult.RefreshToken!,
      expiresIn: response.AuthenticationResult.ExpiresIn || 3600,
    };
  } catch (error) {
    console.error('Failed to authenticate test user:', error);
    throw error;
  }
}

/**
 * Create a test user in Cognito
 *
 * @param email - User email
 * @param password - User password
 * @returns Created user details
 */
export async function createTestUser(email: string, password: string): Promise<TestUser> {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;

  if (!userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID must be set');
  }

  try {
    // Create user
    const createCommand = new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        {
          Name: 'email_verified',
          Value: 'true',
        },
      ],
      MessageAction: 'SUPPRESS', // Don't send welcome email
    });

    await cognitoClient.send(createCommand);

    // Set permanent password
    const setPasswordCommand = new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
      Password: password,
      Permanent: true,
    });

    await cognitoClient.send(setPasswordCommand);

    // Get user details to retrieve sub
    const getUserCommand = new AdminGetUserCommand({
      UserPoolId: userPoolId,
      Username: email,
    });

    const userResponse = await cognitoClient.send(getUserCommand);
    const subAttribute = userResponse.UserAttributes?.find((attr) => attr.Name === 'sub');

    return {
      email,
      password,
      sub: subAttribute?.Value,
    };
  } catch (error) {
    console.error('Failed to create test user:', error);
    throw error;
  }
}

/**
 * Delete a test user from Cognito
 *
 * @param email - User email to delete
 */
export async function deleteTestUser(email: string): Promise<void> {
  const userPoolId = process.env.COGNITO_USER_POOL_ID;

  if (!userPoolId) {
    throw new Error('COGNITO_USER_POOL_ID must be set');
  }

  try {
    const command = new AdminDeleteUserCommand({
      UserPoolId: userPoolId,
      Username: email,
    });

    await cognitoClient.send(command);
  } catch (error) {
    // Ignore if user doesn't exist
    const err = error as { name?: string };
    if (err.name !== 'UserNotFoundException') {
      console.error('Failed to delete test user:', error);
      throw error;
    }
  }
}

/**
 * Get or create a test user for E2E tests
 *
 * This function attempts to authenticate with existing credentials,
 * and creates a new user if authentication fails.
 *
 * @returns JWT tokens for the test user
 */
export async function getOrCreateTestUser(): Promise<{
  tokens: CognitoTokens;
  user: TestUser;
}> {
  const email = process.env.TEST_USER_EMAIL!;
  const password = process.env.TEST_USER_PASSWORD!;

  try {
    // Try to authenticate with existing user
    const tokens = await authenticateTestUser(email, password);
    return {
      tokens,
      user: { email, password },
    };
  } catch {
    // User doesn't exist or password is wrong, create new user
    console.log('Creating new test user...');
    const user = await createTestUser(email, password);
    const tokens = await authenticateTestUser(email, password);
    return { tokens, user };
  }
}

/**
 * Clean up test user after tests complete
 */
export async function cleanupTestUser(): Promise<void> {
  const email = process.env.TEST_USER_EMAIL;
  if (email) {
    await deleteTestUser(email);
  }
}
