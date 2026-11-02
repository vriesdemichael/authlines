import type { PracticeExample } from '#lib/flow/model.ts';

/**
 * Libraries and gateways someone can go and look at. A line saying what "a library" does has to name
 * some, because that claim is easy to get wrong and hard to notice (ADR-005). Each was read at its
 * source on 2026-11-01. This is for what people will meet, and says nothing about which is better.
 */
const named = {
	authjs: { name: 'Auth.js', url: 'https://github.com/nextauthjs/next-auth' },
	passport: { name: 'passport-oauth2', url: 'https://github.com/jaredhanson/passport-oauth2' },
	springSecurity: {
		name: 'Spring Security',
		url: 'https://github.com/spring-projects/spring-security'
	},
	oauth4webapi: { name: 'oauth4webapi', url: 'https://github.com/panva/oauth4webapi' },
	openidClient: { name: 'openid-client', url: 'https://github.com/panva/openid-client' },
	oidcClientTs: { name: 'oidc-client-ts', url: 'https://github.com/authts/oidc-client-ts' },
	jose: { name: 'jose', url: 'https://github.com/panva/jose' },
	awsJwt: {
		name: "AWS API Gateway's JWT authorizer",
		url: 'https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html'
	}
} as const;

export const example = (
	library: keyof typeof named,
	does: boolean,
	text: string,
	when?: PracticeExample['when']
): PracticeExample => ({ ...named[library], does, text, when });
