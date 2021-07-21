git filter-branch --env-filter '
if [ "$GIT_AUTHOR_NAME" = "adamfaanes" ]; then \
    export GIT_AUTHOR_NAME="Sporf-x" GIT_AUTHOR_EMAIL="lexington142@gmail.com"; \
fi
'
