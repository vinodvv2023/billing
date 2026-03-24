import os
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config

# Using environment variables for auth configuration.
config = Config('.env')

oauth = OAuth(config)

# 1. Google
oauth.register(
    name='google',
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# 2. Apple (Requires specialized setup in production, but generic config here)
oauth.register(
    name='apple',
    server_metadata_url='https://appleid.apple.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'name email'
    }
)

# 3. Microsoft
oauth.register(
    name='microsoft',
    server_metadata_url='https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# 4. Facebook (No standard discovery, need explicit endpoints)
oauth.register(
    name='facebook',
    api_base_url='https://graph.facebook.com/v13.0/',
    access_token_url='https://graph.facebook.com/v13.0/oauth/access_token',
    authorize_url='https://www.facebook.com/v13.0/dialog/oauth',
    client_kwargs={'scope': 'email public_profile'}
)

# 5. X (Twitter) OAuth 2.0 PKCE
oauth.register(
    name='twitter',
    api_base_url='https://api.twitter.com/2/',
    access_token_url='https://api.twitter.com/2/oauth2/token',
    authorize_url='https://twitter.com/i/oauth2/authorize',
    client_kwargs={'scope': 'users.read tweet.read'},
)

# 6. GitHub
oauth.register(
    name='github',
    access_token_url='https://github.com/login/oauth/access_token',
    authorize_url='https://github.com/login/oauth/authorize',
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'user:email'}
)

# 7. GitLab
oauth.register(
    name='gitlab',
    server_metadata_url='https://gitlab.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'read_user profile email'}
)

# 8. Discord
oauth.register(
    name='discord',
    access_token_url='https://discord.com/api/oauth2/token',
    authorize_url='https://discord.com/api/oauth2/authorize',
    api_base_url='https://discord.com/api/v10/',
    client_kwargs={'scope': 'identify email'}
)

# 9. Reddit
oauth.register(
    name='reddit',
    access_token_url='https://www.reddit.com/api/v1/access_token',
    authorize_url='https://www.reddit.com/api/v1/authorize',
    api_base_url='https://oauth.reddit.com/',
    client_kwargs={'scope': 'identity'}
)

# 10. Instagram (Basic Display API)
oauth.register(
    name='instagram',
    access_token_url='https://api.instagram.com/oauth/access_token',
    authorize_url='https://api.instagram.com/oauth/authorize',
    client_kwargs={'scope': 'user_profile'}
)

# 11. Amazon
oauth.register(
    name='amazon',
    access_token_url='https://api.amazon.com/auth/o2/token',
    authorize_url='https://www.amazon.com/ap/oa',
    api_base_url='https://api.amazon.com/',
    client_kwargs={'scope': 'profile'}
)

# 12. Dropbox
oauth.register(
    name='dropbox',
    access_token_url='https://api.dropboxapi.com/oauth2/token',
    authorize_url='https://www.dropbox.com/oauth2/authorize',
    api_base_url='https://api.dropboxapi.com/2/',
    client_kwargs={'scope': 'account_info.read'}
)

# 13. LinkedIn (OIDC)
oauth.register(
    name='linkedin',
    server_metadata_url='https://www.linkedin.com/oauth/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid profile email'
    }
)
