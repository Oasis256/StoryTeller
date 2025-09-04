# OpenID Connect Setup Guide

## 🚨 **Current Issue**

Your AudbleTales server is experiencing logout errors because OpenID Connect is enabled but not properly configured.

## 🔧 **Quick Fix Options**

### **Option 1: Disable OpenID (Immediate Solution)**

Set your authentication methods to only use local authentication:

```javascript
authActiveAuthMethods: ['local']
```

### **Option 2: Complete OpenID Setup (Recommended)**

Configure all required OpenID Connect settings:

## 📋 **Required OpenID Connect Settings**

### **Basic Configuration**

```javascript
// Your Identity Provider details
authOpenIDIssuerURL: 'https://your-identity-provider.com'
authOpenIDAuthorizationURL: 'https://your-identity-provider.com/auth'
authOpenIDTokenURL: 'https://your-identity-provider.com/token'
authOpenIDUserInfoURL: 'https://your-identity-provider.com/userinfo'
authOpenIDJwksURL: 'https://your-identity-provider.com/jwks'

// Your application credentials
authOpenIDClientID: 'your-client-id'
authOpenIDClientSecret: 'your-client-secret'
authOpenIDTokenSigningAlgorithm: 'RS256' // or "HS256"

// Optional settings
authOpenIDButtonText: 'Login with SSO'
authOpenIDAutoLaunch: false
authOpenIDAutoRegister: true
```

### **Popular Identity Providers**

#### **Keycloak**

```javascript
authOpenIDIssuerURL: 'https://your-keycloak.com/auth/realms/your-realm'
authOpenIDAuthorizationURL: 'https://your-keycloak.com/auth/realms/your-realm/protocol/openid-connect/auth'
authOpenIDTokenURL: 'https://your-keycloak.com/auth/realms/your-realm/protocol/openid-connect/token'
authOpenIDUserInfoURL: 'https://your-keycloak.com/auth/realms/your-realm/protocol/openid-connect/userinfo'
authOpenIDJwksURL: 'https://your-keycloak.com/auth/realms/your-realm/protocol/openid-connect/certs'
```

#### **Auth0**

```javascript
authOpenIDIssuerURL: 'https://your-tenant.auth0.com'
authOpenIDAuthorizationURL: 'https://your-tenant.auth0.com/authorize'
authOpenIDTokenURL: 'https://your-tenant.auth0.com/oauth/token'
authOpenIDUserInfoURL: 'https://your-tenant.auth0.com/userinfo'
authOpenIDJwksURL: 'https://your-tenant.auth0.com/.well-known/jwks.json'
```

#### **Azure AD**

```javascript
authOpenIDIssuerURL: 'https://login.microsoftonline.com/your-tenant-id/v2.0'
authOpenIDAuthorizationURL: 'https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0/authorize'
authOpenIDTokenURL: 'https://login.microsoftonline.com/your-tenant-id/oauth2/v2.0/token'
authOpenIDUserInfoURL: 'https://graph.microsoft.com/oidc/userinfo'
authOpenIDJwksURL: 'https://login.microsoftonline.com/your-tenant-id/discovery/v2.0/keys'
```

## 🛠️ **Configuration Steps**

### **1. Get Your Identity Provider Configuration**

Most providers offer a discovery endpoint at:

```
https://your-provider.com/.well-known/openid-configuration
```

### **2. Update Server Settings**

You can update settings through:

- Web UI: `/config/authentication`
- API: `PUT /api/settings/authentication`
- Database: Direct SQL update

### **3. Test Configuration**

Use the built-in config tester:

```
GET /auth/openid/config?issuer=https://your-provider.com
```

## 🔍 **Troubleshooting**

### **Common Issues**

1. **Missing required fields**: All 8 required fields must be set
2. **Invalid URLs**: URLs must be accessible from your server
3. **CORS issues**: Ensure your provider allows your domain
4. **Client credentials**: Verify client ID and secret are correct

### **Validation Check**

The system automatically validates settings. Check logs for:

```
[ServerSettings] OpenID Connect is enabled but settings are invalid
```

## 🚀 **Testing**

1. **Restart your server** after configuration changes
2. **Try logging in** with OpenID
3. **Test logout** - should work without errors now
4. **Check logs** for any remaining issues

## 📚 **Additional Resources**

- [OpenID Connect Specification](https://openid.net/connect/)
- [Passport.js OpenID Strategy](http://www.passportjs.org/packages/passport-openidconnect/)
- [Your Identity Provider's Documentation]

---

**Note**: After fixing the configuration, the logout error should be resolved. The system will now gracefully handle OpenID operations even if some settings are incomplete.
