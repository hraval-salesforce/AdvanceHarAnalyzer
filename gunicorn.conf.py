import os

# Binding coordinates loaded automatically from Heroku router directives
bind = "0.0.0.0:" + os.getenv("PORT", "5000")

# Set workers based on Heroku's detected dyno limit metrics
workers = int(os.getenv("WEB_CONCURRENCY", "2"))

# Preload application layers to harness memory copy-on-write benefits
preload_app = True

# Gracefully recycle workers to defend against standard Python memory leakage
max_requests = 250
max_requests_jitter = 35

# Critical worker response timeout criteria
timeout = 45
keepalive = 5