// State
let providers = [];
let config = {};
let mcpServers = [];
let teams = [];
let activeTeam = null;
let editingTeamId = null;
let teamMembers = []; // members being edited in the modal
let allTools = [];
let modelsCache = {};
let editingMcpId = null;
let editingId = null;
let catalogFilter = 'all';

// ── MCP Catalog ───────────────────────────────────────────────────────────────

const MCP_CATALOG = [
  {
    id: 'playwright',
    name: 'Playwright',
    category: 'browser',
    official: false,
    description: 'Browser automation, web scraping and UI testing via a real Chromium browser.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@playwright/mcp@latest'],
    env: [],
    tools: ['browser_navigate', 'browser_click', 'browser_fill', 'browser_screenshot', 'browser_evaluate', 'browser_select_option', 'browser_hover', 'browser_type', 'browser_get_text', 'browser_wait'],
  },
  {
    id: 'context7',
    name: 'Context7',
    category: 'docs',
    official: false,
    description: 'Fetches up-to-date documentation for any library directly into the context.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@upstash/context7-mcp'],
    env: [],
    tools: ['resolve-library-id', 'get-library-docs'],
  },
  {
    id: 'sequential-thinking',
    name: 'Sequential Thinking',
    category: 'reasoning',
    official: true,
    description: 'Structured step-by-step reasoning for complex multi-step problems.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-sequential-thinking'],
    env: [],
    tools: ['sequentialthinking'],
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    category: 'code',
    official: false,
    description: 'Manage GitLab repos, issues, merge requests, pipelines and more.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@zereight/mcp-gitlab'],
    env: ['GITLAB_PERSONAL_ACCESS_TOKEN=your_token', 'GITLAB_API_URL=https://gitlab.com/api/v4'],
    tools: ['list_projects', 'get_project', 'list_issues', 'create_issue', 'update_issue', 'list_merge_requests', 'create_merge_request', 'list_pipelines', 'get_file_contents', 'push_files'],
  },
  {
    id: 'github',
    name: 'GitHub',
    category: 'code',
    official: true,
    description: 'Interact with GitHub repos, issues, pull requests, files and search.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-github'],
    env: ['GITHUB_PERSONAL_ACCESS_TOKEN=your_token'],
    tools: ['search_repositories', 'get_file_contents', 'push_files', 'create_issue', 'create_pull_request', 'list_issues', 'create_or_update_file', 'fork_repository', 'create_branch'],
  },
  {
    id: 'filesystem',
    name: 'Filesystem',
    category: 'files',
    official: true,
    description: 'Secure file read/write access to a specified directory on your machine.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-filesystem', '/path/to/dir'],
    env: [],
    tools: ['read_file', 'write_file', 'create_directory', 'list_directory', 'move_file', 'search_files', 'get_file_info'],
  },
  {
    id: 'brave-search',
    name: 'Brave Search',
    category: 'search',
    official: true,
    description: 'Real-time web and local search powered by the Brave Search API.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-brave-search'],
    env: ['BRAVE_API_KEY=your_key'],
    tools: ['brave_web_search', 'brave_local_search'],
  },
  {
    id: 'memory',
    name: 'Memory',
    category: 'reasoning',
    official: true,
    description: 'Persistent knowledge graph memory that survives across sessions.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-memory'],
    env: [],
    tools: ['create_entities', 'create_relations', 'add_observations', 'delete_entities', 'search_nodes', 'read_graph', 'open_nodes'],
  },
  {
    id: 'slack',
    name: 'Slack',
    category: 'communication',
    official: true,
    description: 'Post messages, reply to threads and read channels in Slack workspaces.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-slack'],
    env: ['SLACK_BOT_TOKEN=xoxb-your-token', 'SLACK_TEAM_ID=your_team_id'],
    tools: ['slack_post_message', 'slack_reply_to_thread', 'slack_add_reaction', 'slack_get_channels', 'slack_get_channel_history', 'slack_get_users'],
  },
  {
    id: 'postgres',
    name: 'PostgreSQL',
    category: 'database',
    official: true,
    description: 'Read-only SQL queries against a PostgreSQL database with schema inspection.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-postgres', 'postgresql://user:pass@localhost/db'],
    env: [],
    tools: ['query', 'list_tables', 'describe_table'],
  },
  {
    id: 'sqlite',
    name: 'SQLite',
    category: 'database',
    official: true,
    description: 'Read and write SQLite databases with schema inspection and query execution.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-sqlite', '--db-path', '/path/to/db.sqlite'],
    env: [],
    tools: ['read_query', 'write_query', 'create_table', 'list_tables', 'describe_table', 'append_insight'],
  },
  {
    id: 'puppeteer',
    name: 'Puppeteer',
    category: 'browser',
    official: true,
    description: 'Headless browser automation with screenshots and JavaScript evaluation.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-puppeteer'],
    env: [],
    tools: ['puppeteer_navigate', 'puppeteer_screenshot', 'puppeteer_click', 'puppeteer_fill', 'puppeteer_evaluate', 'puppeteer_select', 'puppeteer_hover'],
  },
  {
    id: 'jira',
    name: 'Jira',
    category: 'communication',
    official: false,
    description: 'Create, update and search Jira issues and projects.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'mcp-server-jira'],
    env: ['JIRA_HOST=https://your-org.atlassian.net', 'JIRA_EMAIL=you@example.com', 'JIRA_API_TOKEN=your_token'],
    tools: ['get_issue', 'create_issue', 'update_issue', 'search_issues', 'list_projects', 'add_comment'],
  },
  {
    id: 'notion',
    name: 'Notion',
    category: 'docs',
    official: false,
    description: 'Read and write Notion pages, databases and blocks.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@suesu/notion-mcp-server'],
    env: ['NOTION_API_TOKEN=secret_your_token'],
    tools: ['get_page', 'create_page', 'update_page', 'query_database', 'search', 'append_block'],
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    category: 'files',
    official: true,
    description: 'Search, read and export files from Google Drive including Docs and Sheets.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-gdrive'],
    env: ['GDRIVE_CREDENTIALS_PATH=/path/to/credentials.json'],
    tools: ['search', 'read_file', 'list_files'],
  },
  {
    id: 'google-maps',
    name: 'Google Maps',
    category: 'search',
    official: true,
    description: 'Geocoding, directions, place search and distance matrix via Google Maps.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-google-maps'],
    env: ['GOOGLE_MAPS_API_KEY=your_key'],
    tools: ['maps_geocode', 'maps_reverse_geocode', 'maps_search_places', 'maps_place_details', 'maps_directions', 'maps_distance_matrix'],
  },
  {
    id: 'aws-kb',
    name: 'AWS Knowledge Base',
    category: 'search',
    official: true,
    description: 'Retrieve content from AWS Bedrock Knowledge Bases using semantic search.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-aws-kb-retrieval'],
    env: ['AWS_ACCESS_KEY_ID=your_key', 'AWS_SECRET_ACCESS_KEY=your_secret', 'AWS_REGION=us-east-1'],
    tools: ['retrieve'],
  },
  {
    id: 'everart',
    name: 'EverArt',
    category: 'media',
    official: true,
    description: 'Generate images using EverArt AI image generation models.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-everart'],
    env: ['EVERART_API_KEY=your_key'],
    tools: ['generate_image'],
  },
  {
    id: 'fetch',
    name: 'Fetch',
    category: 'search',
    official: true,
    description: 'Fetch web pages and convert them to Markdown for LLM consumption.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-fetch'],
    env: [],
    tools: ['fetch'],
  },
  {
    id: 'sentry',
    name: 'Sentry',
    category: 'code',
    official: false,
    description: 'Query Sentry issues, events and releases for debugging and monitoring.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-sentry'],
    env: ['SENTRY_AUTH_TOKEN=your_token', 'SENTRY_ORG=your_org'],
    tools: ['get_issue', 'list_issues', 'get_event', 'list_projects', 'get_stacktrace'],
  },
  {
    id: 'linear',
    name: 'Linear',
    category: 'communication',
    official: false,
    description: 'Manage Linear issues, projects and cycles for engineering teams.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'linear-mcp-server'],
    env: ['LINEAR_API_KEY=your_key'],
    tools: ['list_issues', 'get_issue', 'create_issue', 'update_issue', 'list_projects', 'list_teams'],
  },
  {
    id: 'discord',
    name: 'Discord',
    category: 'communication',
    official: false,
    description: 'Send messages and read channels in Discord servers.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'discord-mcp-server'],
    env: ['DISCORD_BOT_TOKEN=your_token'],
    tools: ['send_message', 'get_messages', 'list_channels', 'list_guilds', 'create_thread'],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'database',
    official: false,
    description: 'Query Stripe customers, payments, subscriptions and invoices.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@stripe/agent-toolkit'],
    env: ['STRIPE_SECRET_KEY=sk_test_your_key'],
    tools: ['list_customers', 'get_customer', 'list_payments', 'list_subscriptions', 'create_payment_link', 'list_invoices'],
  },
  {
    id: 'kubernetes',
    name: 'Kubernetes',
    category: 'code',
    official: false,
    description: 'Inspect and manage Kubernetes clusters, pods, deployments and services.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'kubernetes-mcp-server'],
    env: [],
    tools: ['list_pods', 'get_pod', 'list_deployments', 'scale_deployment', 'list_services', 'get_logs', 'list_namespaces'],
  },
  {
    id: 'docker',
    name: 'Docker',
    category: 'code',
    official: false,
    description: 'Manage Docker containers, images, volumes and networks.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'docker-mcp-server'],
    env: [],
    tools: ['list_containers', 'start_container', 'stop_container', 'list_images', 'pull_image', 'get_logs'],
  },
  {
    id: 'redis',
    name: 'Redis',
    category: 'database',
    official: false,
    description: 'Read and write Redis keys, hashes, lists and sets.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'redis-mcp-server'],
    env: ['REDIS_URL=redis://localhost:6379'],
    tools: ['get', 'set', 'delete', 'list_keys', 'hget', 'hset', 'lpush', 'lrange'],
  },
  {
    id: 'mongodb',
    name: 'MongoDB',
    category: 'database',
    official: false,
    description: 'Query and update MongoDB collections with aggregation support.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'mongodb-mcp-server'],
    env: ['MONGODB_URI=mongodb://localhost:27017'],
    tools: ['find', 'insert_one', 'update_one', 'delete_one', 'aggregate', 'list_collections', 'list_databases'],
  },
  {
    id: 'elasticsearch',
    name: 'Elasticsearch',
    category: 'database',
    official: false,
    description: 'Search and index documents in Elasticsearch clusters.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'elasticsearch-mcp-server'],
    env: ['ELASTICSEARCH_URL=http://localhost:9200'],
    tools: ['search', 'index_document', 'get_document', 'delete_document', 'list_indices'],
  },
  {
    id: 'figma',
    name: 'Figma',
    category: 'media',
    official: false,
    description: 'Read Figma files, components, frames and export assets.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'figma-mcp-server'],
    env: ['FIGMA_ACCESS_TOKEN=your_token'],
    tools: ['get_file', 'get_node', 'list_files', 'export_image', 'get_components'],
  },
  {
    id: 'aws-cli',
    name: 'AWS CLI',
    category: 'code',
    official: false,
    description: 'Execute AWS CLI commands to manage cloud infrastructure.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'aws-mcp-server'],
    env: ['AWS_ACCESS_KEY_ID=your_key', 'AWS_SECRET_ACCESS_KEY=your_secret', 'AWS_DEFAULT_REGION=us-east-1'],
    tools: ['run_command', 'list_s3_buckets', 'describe_instances', 'list_lambda_functions', 'describe_stacks'],
  },
  {
    id: 'terraform',
    name: 'Terraform',
    category: 'code',
    official: false,
    description: 'Plan, apply and inspect Terraform infrastructure as code.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'terraform-mcp-server'],
    env: [],
    tools: ['plan', 'apply', 'destroy', 'show', 'list_resources', 'get_state'],
  },
  {
    id: 'openapi',
    name: 'OpenAPI',
    category: 'docs',
    official: false,
    description: 'Load and query any REST API described by an OpenAPI/Swagger spec.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'openapi-mcp-server'],
    env: ['OPENAPI_SPEC_URL=https://your-api.com/openapi.json'],
    tools: ['list_endpoints', 'call_endpoint', 'get_schema'],
  },

  // ── Email ─────────────────────────────────────────────────────────────────
  {
    id: 'gmail',
    name: 'Gmail',
    category: 'email',
    official: false,
    description: 'Read, send and manage Gmail messages, threads and labels.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-gmail'],
    env: ['GMAIL_CREDENTIALS_PATH=/path/to/credentials.json'],
    tools: ['list_messages', 'get_message', 'send_message', 'reply_message', 'list_labels', 'search_messages', 'trash_message'],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    category: 'email',
    official: false,
    description: 'Send transactional and marketing emails via SendGrid.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'sendgrid-mcp-server'],
    env: ['SENDGRID_API_KEY=SG.your_key'],
    tools: ['send_email', 'send_template_email', 'list_templates', 'get_stats'],
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    category: 'email',
    official: false,
    description: 'Manage Mailchimp audiences, campaigns and email automation.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'mailchimp-mcp-server'],
    env: ['MAILCHIMP_API_KEY=your_key', 'MAILCHIMP_SERVER_PREFIX=us1'],
    tools: ['list_campaigns', 'create_campaign', 'send_campaign', 'list_audiences', 'add_subscriber', 'get_reports'],
  },
  {
    id: 'resend',
    name: 'Resend',
    category: 'email',
    official: false,
    description: 'Send emails via the Resend developer email platform.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'resend-mcp-server'],
    env: ['RESEND_API_KEY=re_your_key'],
    tools: ['send_email', 'list_emails', 'get_email', 'create_audience', 'add_contact'],
  },

  // ── CRM ──────────────────────────────────────────────────────────────────
  {
    id: 'hubspot',
    name: 'HubSpot',
    category: 'crm',
    official: false,
    description: 'Manage HubSpot contacts, companies, deals and tickets.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'hubspot-mcp-server'],
    env: ['HUBSPOT_ACCESS_TOKEN=your_token'],
    tools: ['list_contacts', 'get_contact', 'create_contact', 'update_contact', 'list_deals', 'create_deal', 'list_companies', 'create_ticket'],
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    category: 'crm',
    official: false,
    description: 'Query and update Salesforce objects, records and reports.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'salesforce-mcp-server'],
    env: ['SALESFORCE_USERNAME=you@org.com', 'SALESFORCE_PASSWORD=your_pass', 'SALESFORCE_TOKEN=your_token'],
    tools: ['soql_query', 'get_record', 'create_record', 'update_record', 'delete_record', 'list_objects', 'describe_object'],
  },
  {
    id: 'pipedrive',
    name: 'Pipedrive',
    category: 'crm',
    official: false,
    description: 'Manage Pipedrive deals, contacts, activities and pipelines.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'pipedrive-mcp-server'],
    env: ['PIPEDRIVE_API_TOKEN=your_token'],
    tools: ['list_deals', 'create_deal', 'update_deal', 'list_persons', 'create_person', 'list_activities', 'create_activity'],
  },

  // ── AI / ML ───────────────────────────────────────────────────────────────
  {
    id: 'pinecone',
    name: 'Pinecone',
    category: 'ai',
    official: false,
    description: 'Upsert and query vectors in Pinecone vector database for semantic search.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'pinecone-mcp-server'],
    env: ['PINECONE_API_KEY=your_key', 'PINECONE_ENVIRONMENT=us-east-1-aws'],
    tools: ['upsert_vectors', 'query_vectors', 'delete_vectors', 'list_indexes', 'describe_index_stats'],
  },
  {
    id: 'qdrant',
    name: 'Qdrant',
    category: 'ai',
    official: false,
    description: 'Store and search vectors in Qdrant for RAG and semantic search pipelines.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'qdrant-mcp-server'],
    env: ['QDRANT_URL=http://localhost:6333', 'QDRANT_API_KEY=your_key'],
    tools: ['upsert_points', 'search', 'delete_points', 'list_collections', 'create_collection', 'get_collection'],
  },
  {
    id: 'chroma',
    name: 'ChromaDB',
    category: 'ai',
    official: false,
    description: 'Open-source embedding database for AI applications and RAG workflows.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'chroma-mcp-server'],
    env: ['CHROMA_HOST=http://localhost:8000'],
    tools: ['add_documents', 'query', 'delete', 'list_collections', 'create_collection', 'peek'],
  },
  {
    id: 'huggingface',
    name: 'Hugging Face',
    category: 'ai',
    official: false,
    description: 'Run inference on Hugging Face models and search the model hub.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'huggingface-mcp-server'],
    env: ['HUGGINGFACE_API_KEY=hf_your_key'],
    tools: ['run_inference', 'search_models', 'get_model_info', 'list_datasets', 'text_generation', 'image_classification'],
  },
  {
    id: 'langchain',
    name: 'LangSmith',
    category: 'ai',
    official: false,
    description: 'Trace, debug and evaluate LangChain applications via LangSmith.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'langsmith-mcp-server'],
    env: ['LANGSMITH_API_KEY=your_key', 'LANGSMITH_PROJECT=default'],
    tools: ['list_runs', 'get_run', 'list_datasets', 'create_dataset', 'list_projects', 'get_feedback'],
  },

  // ── Cloud ─────────────────────────────────────────────────────────────────
  {
    id: 'aws-s3',
    name: 'AWS S3',
    category: 'cloud',
    official: false,
    description: 'List, read, upload and delete objects in AWS S3 buckets.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'aws-s3-mcp-server'],
    env: ['AWS_ACCESS_KEY_ID=your_key', 'AWS_SECRET_ACCESS_KEY=your_secret', 'AWS_DEFAULT_REGION=us-east-1'],
    tools: ['list_buckets', 'list_objects', 'get_object', 'put_object', 'delete_object', 'create_bucket'],
  },
  {
    id: 'azure',
    name: 'Azure',
    category: 'cloud',
    official: false,
    description: 'Manage Azure resources, VMs, storage and App Services.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'azure-mcp-server'],
    env: ['AZURE_SUBSCRIPTION_ID=your_id', 'AZURE_TENANT_ID=your_tenant', 'AZURE_CLIENT_ID=your_client', 'AZURE_CLIENT_SECRET=your_secret'],
    tools: ['list_resource_groups', 'list_resources', 'list_vms', 'start_vm', 'stop_vm', 'list_storage_accounts'],
  },
  {
    id: 'gcp',
    name: 'Google Cloud',
    category: 'cloud',
    official: false,
    description: 'Manage GCP resources, Cloud Run, Cloud Storage and BigQuery.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'gcp-mcp-server'],
    env: ['GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json', 'GCP_PROJECT_ID=your_project'],
    tools: ['list_buckets', 'list_functions', 'list_run_services', 'run_bigquery', 'list_instances', 'list_clusters'],
  },
  {
    id: 'vercel',
    name: 'Vercel',
    category: 'cloud',
    official: false,
    description: 'Deploy and manage Vercel projects, deployments and domains.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'vercel-mcp-server'],
    env: ['VERCEL_TOKEN=your_token'],
    tools: ['list_projects', 'list_deployments', 'get_deployment', 'create_deployment', 'list_domains', 'get_logs'],
  },
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    category: 'cloud',
    official: false,
    description: 'Manage Cloudflare zones, DNS records, Workers and KV storage.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'cloudflare-mcp-server'],
    env: ['CLOUDFLARE_API_TOKEN=your_token', 'CLOUDFLARE_ACCOUNT_ID=your_account_id'],
    tools: ['list_zones', 'list_dns_records', 'create_dns_record', 'list_workers', 'deploy_worker', 'kv_get', 'kv_put'],
  },
  {
    id: 'heroku',
    name: 'Heroku',
    category: 'cloud',
    official: false,
    description: 'Manage Heroku apps, dynos, add-ons and deployments.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'heroku-mcp-server'],
    env: ['HEROKU_API_KEY=your_key'],
    tools: ['list_apps', 'get_app', 'restart_dynos', 'list_addons', 'get_logs', 'list_releases'],
  },

  // ── Monitoring ────────────────────────────────────────────────────────────
  {
    id: 'datadog',
    name: 'Datadog',
    category: 'monitoring',
    official: false,
    description: 'Query Datadog metrics, logs, monitors and dashboards.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'datadog-mcp-server'],
    env: ['DD_API_KEY=your_key', 'DD_APP_KEY=your_app_key', 'DD_SITE=datadoghq.com'],
    tools: ['query_metrics', 'list_monitors', 'get_monitor', 'list_dashboards', 'search_logs', 'list_incidents'],
  },
  {
    id: 'grafana',
    name: 'Grafana',
    category: 'monitoring',
    official: false,
    description: 'Query Grafana dashboards, alerts and data source metrics.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'grafana-mcp-server'],
    env: ['GRAFANA_URL=http://localhost:3000', 'GRAFANA_API_KEY=your_key'],
    tools: ['list_dashboards', 'get_dashboard', 'list_alerts', 'query_datasource', 'list_datasources'],
  },
  {
    id: 'newrelic',
    name: 'New Relic',
    category: 'monitoring',
    official: false,
    description: 'Query New Relic APM metrics, errors, transactions and NRQL.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'newrelic-mcp-server'],
    env: ['NEW_RELIC_API_KEY=NRAK-your_key', 'NEW_RELIC_ACCOUNT_ID=your_account_id'],
    tools: ['nrql_query', 'list_applications', 'get_apm_metrics', 'list_alerts', 'get_error_traces'],
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    category: 'monitoring',
    official: false,
    description: 'Manage PagerDuty incidents, escalations, on-call schedules and alerts.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'pagerduty-mcp-server'],
    env: ['PAGERDUTY_API_KEY=your_key'],
    tools: ['list_incidents', 'get_incident', 'acknowledge_incident', 'resolve_incident', 'list_services', 'list_schedules', 'create_incident'],
  },
  {
    id: 'prometheus',
    name: 'Prometheus',
    category: 'monitoring',
    official: false,
    description: 'Execute PromQL queries and explore Prometheus metrics and alerts.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'prometheus-mcp-server'],
    env: ['PROMETHEUS_URL=http://localhost:9090'],
    tools: ['query', 'query_range', 'list_metrics', 'list_labels', 'list_alerts', 'list_targets'],
  },

  // ── Finance ───────────────────────────────────────────────────────────────
  {
    id: 'plaid',
    name: 'Plaid',
    category: 'finance',
    official: false,
    description: 'Connect bank accounts, retrieve transactions and check balances via Plaid.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'plaid-mcp-server'],
    env: ['PLAID_CLIENT_ID=your_id', 'PLAID_SECRET=your_secret', 'PLAID_ENV=sandbox'],
    tools: ['get_accounts', 'get_transactions', 'get_balance', 'get_institutions', 'get_identity'],
  },
  {
    id: 'paypal',
    name: 'PayPal',
    category: 'finance',
    official: false,
    description: 'Create and manage PayPal orders, payments and subscriptions.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'paypal-mcp-server'],
    env: ['PAYPAL_CLIENT_ID=your_id', 'PAYPAL_CLIENT_SECRET=your_secret', 'PAYPAL_ENV=sandbox'],
    tools: ['create_order', 'capture_order', 'get_order', 'list_transactions', 'create_subscription', 'list_subscriptions'],
  },
  {
    id: 'quickbooks',
    name: 'QuickBooks',
    category: 'finance',
    official: false,
    description: 'Read and write QuickBooks invoices, customers, expenses and reports.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'quickbooks-mcp-server'],
    env: ['QB_CLIENT_ID=your_id', 'QB_CLIENT_SECRET=your_secret', 'QB_REALM_ID=your_realm'],
    tools: ['list_invoices', 'create_invoice', 'list_customers', 'create_customer', 'list_expenses', 'get_profit_loss'],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    category: 'finance',
    official: false,
    description: 'Manage Shopify products, orders, customers and inventory.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'shopify-mcp-server'],
    env: ['SHOPIFY_SHOP=your-store.myshopify.com', 'SHOPIFY_ACCESS_TOKEN=your_token'],
    tools: ['list_products', 'create_product', 'list_orders', 'get_order', 'list_customers', 'update_inventory'],
  },

  // ── Communication extras ──────────────────────────────────────────────────
  {
    id: 'twilio',
    name: 'Twilio',
    category: 'communication',
    official: false,
    description: 'Send SMS, make calls and manage phone numbers via Twilio.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'twilio-mcp-server'],
    env: ['TWILIO_ACCOUNT_SID=ACyour_sid', 'TWILIO_AUTH_TOKEN=your_token', 'TWILIO_PHONE_NUMBER=+1234567890'],
    tools: ['send_sms', 'make_call', 'list_messages', 'list_calls', 'list_phone_numbers'],
  },
  {
    id: 'zoom',
    name: 'Zoom',
    category: 'communication',
    official: false,
    description: 'Schedule and manage Zoom meetings, participants and recordings.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'zoom-mcp-server'],
    env: ['ZOOM_ACCOUNT_ID=your_id', 'ZOOM_CLIENT_ID=your_client', 'ZOOM_CLIENT_SECRET=your_secret'],
    tools: ['create_meeting', 'list_meetings', 'get_meeting', 'delete_meeting', 'list_recordings', 'list_participants'],
  },
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    category: 'communication',
    official: false,
    description: 'Create, read and update Google Calendar events and schedules.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-google-calendar'],
    env: ['GOOGLE_CREDENTIALS_PATH=/path/to/credentials.json'],
    tools: ['list_events', 'create_event', 'update_event', 'delete_event', 'list_calendars', 'find_free_time'],
  },
  {
    id: 'microsoft-teams',
    name: 'Microsoft Teams',
    category: 'communication',
    official: false,
    description: 'Send messages and manage channels in Microsoft Teams.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'teams-mcp-server'],
    env: ['TEAMS_TENANT_ID=your_tenant', 'TEAMS_CLIENT_ID=your_client', 'TEAMS_CLIENT_SECRET=your_secret'],
    tools: ['send_message', 'list_teams', 'list_channels', 'get_messages', 'create_channel', 'list_members'],
  },
  {
    id: 'asana',
    name: 'Asana',
    category: 'communication',
    official: false,
    description: 'Manage Asana tasks, projects, teams and workspaces.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'asana-mcp-server'],
    env: ['ASANA_ACCESS_TOKEN=your_token'],
    tools: ['list_tasks', 'create_task', 'update_task', 'list_projects', 'create_project', 'list_workspaces'],
  },
  {
    id: 'trello',
    name: 'Trello',
    category: 'communication',
    official: false,
    description: 'Manage Trello boards, lists, cards and members.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'trello-mcp-server'],
    env: ['TRELLO_API_KEY=your_key', 'TRELLO_TOKEN=your_token'],
    tools: ['list_boards', 'list_lists', 'list_cards', 'create_card', 'update_card', 'move_card', 'add_comment'],
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    category: 'communication',
    official: false,
    description: 'Read and post tweets, manage followers and search the X/Twitter API.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'twitter-mcp-server'],
    env: ['TWITTER_API_KEY=your_key', 'TWITTER_API_SECRET=your_secret', 'TWITTER_ACCESS_TOKEN=your_token', 'TWITTER_ACCESS_SECRET=your_secret'],
    tools: ['post_tweet', 'get_timeline', 'search_tweets', 'get_user', 'list_followers', 'like_tweet', 'retweet'],
  },

  // ── Docs extras ───────────────────────────────────────────────────────────
  {
    id: 'confluence',
    name: 'Confluence',
    category: 'docs',
    official: false,
    description: 'Read and write Confluence pages, spaces and comments.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'confluence-mcp-server'],
    env: ['CONFLUENCE_HOST=https://your-org.atlassian.net', 'CONFLUENCE_EMAIL=you@example.com', 'CONFLUENCE_API_TOKEN=your_token'],
    tools: ['get_page', 'create_page', 'update_page', 'list_spaces', 'search', 'list_pages', 'add_comment'],
  },
  {
    id: 'google-sheets',
    name: 'Google Sheets',
    category: 'docs',
    official: false,
    description: 'Read and write Google Sheets spreadsheets and cell data.',
    command: 'npx',
    args: ['--prefer-offline', '-y', '@modelcontextprotocol/server-gsheets'],
    env: ['GOOGLE_CREDENTIALS_PATH=/path/to/credentials.json'],
    tools: ['read_sheet', 'write_sheet', 'append_rows', 'list_sheets', 'create_sheet', 'clear_range'],
  },
  {
    id: 'airtable',
    name: 'Airtable',
    category: 'docs',
    official: false,
    description: 'Query and update Airtable bases, tables and records.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'airtable-mcp-server'],
    env: ['AIRTABLE_API_KEY=your_key'],
    tools: ['list_bases', 'list_tables', 'list_records', 'create_record', 'update_record', 'delete_record', 'search_records'],
  },
  {
    id: 'wikipedia',
    name: 'Wikipedia',
    category: 'search',
    official: false,
    description: 'Search and retrieve Wikipedia article summaries and full content.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'wikipedia-mcp-server'],
    env: [],
    tools: ['search', 'get_summary', 'get_article', 'get_sections', 'get_links'],
  },
  {
    id: 'arxiv',
    name: 'arXiv',
    category: 'search',
    official: false,
    description: 'Search and retrieve academic papers from arXiv.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'arxiv-mcp-server'],
    env: [],
    tools: ['search_papers', 'get_paper', 'get_abstract', 'download_pdf', 'list_categories'],
  },

  // ── Code extras ───────────────────────────────────────────────────────────
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    category: 'code',
    official: false,
    description: 'Manage Bitbucket repositories, pull requests and pipelines.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'bitbucket-mcp-server'],
    env: ['BITBUCKET_USERNAME=your_user', 'BITBUCKET_APP_PASSWORD=your_pass'],
    tools: ['list_repos', 'get_repo', 'list_pull_requests', 'create_pull_request', 'list_pipelines', 'get_file_contents'],
  },
  {
    id: 'circleci',
    name: 'CircleCI',
    category: 'code',
    official: false,
    description: 'Trigger and inspect CircleCI pipelines, workflows and jobs.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'circleci-mcp-server'],
    env: ['CIRCLECI_TOKEN=your_token'],
    tools: ['list_pipelines', 'get_pipeline', 'trigger_pipeline', 'list_workflows', 'get_job_logs', 'list_projects'],
  },
  {
    id: 'jenkins',
    name: 'Jenkins',
    category: 'code',
    official: false,
    description: 'Trigger Jenkins builds and inspect job status and logs.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'jenkins-mcp-server'],
    env: ['JENKINS_URL=http://localhost:8080', 'JENKINS_USER=admin', 'JENKINS_TOKEN=your_token'],
    tools: ['list_jobs', 'get_job', 'trigger_build', 'get_build_status', 'get_build_logs', 'list_builds'],
  },
  {
    id: 'sonarqube',
    name: 'SonarQube',
    category: 'code',
    official: false,
    description: 'Inspect SonarQube code quality metrics, issues and security hotspots.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'sonarqube-mcp-server'],
    env: ['SONARQUBE_URL=http://localhost:9000', 'SONARQUBE_TOKEN=your_token'],
    tools: ['list_projects', 'get_measures', 'list_issues', 'get_hotspots', 'get_quality_gate'],
  },
  {
    id: 'npm',
    name: 'npm',
    category: 'code',
    official: false,
    description: 'Search npm packages, get info, check versions and vulnerabilities.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'npm-mcp-server'],
    env: [],
    tools: ['search_packages', 'get_package_info', 'get_versions', 'check_vulnerabilities', 'get_downloads'],
  },

  // ── Media extras ─────────────────────────────────────────────────────────
  {
    id: 'youtube',
    name: 'YouTube',
    category: 'media',
    official: false,
    description: 'Search YouTube videos, retrieve transcripts and channel data.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'youtube-mcp-server'],
    env: ['YOUTUBE_API_KEY=your_key'],
    tools: ['search_videos', 'get_video', 'get_transcript', 'list_channel_videos', 'get_channel', 'get_comments'],
  },
  {
    id: 'spotify',
    name: 'Spotify',
    category: 'media',
    official: false,
    description: 'Control Spotify playback and browse tracks, albums and playlists.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'spotify-mcp-server'],
    env: ['SPOTIFY_CLIENT_ID=your_id', 'SPOTIFY_CLIENT_SECRET=your_secret'],
    tools: ['search', 'play_track', 'pause', 'skip', 'list_playlists', 'get_currently_playing', 'add_to_playlist'],
  },
  {
    id: 'cloudinary',
    name: 'Cloudinary',
    category: 'media',
    official: false,
    description: 'Upload, transform and manage images and videos in Cloudinary.',
    command: 'npx',
    args: ['--prefer-offline', '-y', 'cloudinary-mcp-server'],
    env: ['CLOUDINARY_CLOUD_NAME=your_cloud', 'CLOUDINARY_API_KEY=your_key', 'CLOUDINARY_API_SECRET=your_secret'],
    tools: ['upload_image', 'list_resources', 'transform_image', 'delete_resource', 'get_resource_info', 'search'],
  },
];

const CATALOG_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'browser', label: 'Browser' },
  { id: 'code', label: 'Code' },
  { id: 'database', label: 'Database' },
  { id: 'docs', label: 'Docs' },
  { id: 'files', label: 'Files' },
  { id: 'reasoning', label: 'Reasoning' },
  { id: 'search', label: 'Search' },
  { id: 'communication', label: 'Communication' },
  { id: 'email', label: 'Email' },
  { id: 'crm', label: 'CRM' },
  { id: 'ai', label: 'AI / ML' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'media', label: 'Media' },
  { id: 'finance', label: 'Finance' },
];

function openCatalog() {
  document.getElementById('catalog-overlay').style.display = 'flex';
  catalogFilter = 'all';
  renderCatalogFilters();
  renderCatalog();
  setTimeout(() => document.getElementById('catalog-search').focus(), 50);
}

function closeCatalog() {
  document.getElementById('catalog-overlay').style.display = 'none';
  document.getElementById('catalog-search').value = '';
}

function renderCatalogFilters() {
  const el = document.getElementById('catalog-filters');
  el.innerHTML = CATALOG_CATEGORIES.map(c => `
    <button class="catalog-filter-btn ${catalogFilter === c.id ? 'active' : ''}"
      onclick="setCatalogFilter('${c.id}')">${c.label}</button>
  `).join('');
}

function setCatalogFilter(id) {
  catalogFilter = id;
  renderCatalogFilters();
  renderCatalog();
}

function renderCatalog() {
  const q = (document.getElementById('catalog-search').value || '').toLowerCase();
  const grid = document.getElementById('catalog-grid');

  const filtered = MCP_CATALOG.filter(s => {
    const matchCat = catalogFilter === 'all' || s.category === catalogFilter;
    const matchQ = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) ||
      s.tools.some(t => t.toLowerCase().includes(q));
    return matchCat && matchQ;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:0.78rem;grid-column:1/-1;text-align:center;padding:40px 0">No servers match your search.</p>';
    return;
  }

  grid.innerHTML = filtered.map(s => {
    const visibleTools = s.tools.slice(0, 5);
    const moreCount = s.tools.length - visibleTools.length;
    const envHtml = s.env.length
      ? `<div class="catalog-card-env">Requires: ${s.env.map(e => `<code>${e.split('=')[0]}</code>`).join(', ')}</div>`
      : '';
    return `
      <div class="catalog-card">
        <div class="catalog-card-head">
          <span class="catalog-card-name">${s.name}</span>
          <div class="catalog-card-badges">
            <span class="catalog-badge ${s.official ? 'badge-official' : 'badge-community'}">${s.official ? 'official' : 'community'}</span>
          </div>
        </div>
        <div class="catalog-card-desc">${s.description}</div>
        <div class="catalog-card-tools">
          ${visibleTools.map(t => `<span class="catalog-tool-tag">${t}</span>`).join('')}
          ${moreCount > 0 ? `<span class="catalog-tool-more">+${moreCount} more</span>` : ''}
        </div>
        ${envHtml}
        <div class="catalog-card-footer">
          <button class="catalog-add-btn" onclick="catalogAdd('${s.id}')">+ Add to Manthra</button>
        </div>
      </div>`;
  }).join('');
}

function catalogAdd(id) {
  const s = MCP_CATALOG.find(x => x.id === id);
  if (!s) return;
  closeCatalog();
  showAddMcp();
  setTimeout(() => {
    document.getElementById('mcp-form-name').value = s.name;
    document.getElementById('mcp-form-transport').value = 'stdio';
    onMcpTransportChange();
    document.getElementById('mcp-form-command').value = s.command;
    document.getElementById('mcp-form-args').value = s.args.join('\n');
    document.getElementById('mcp-form-env').value = s.env.join('\n');
  }, 50);
}

const PROVIDER_META = {
  ollama:     { icon: '🟣', label: 'Ollama' },
  openai:     { icon: '🟢', label: 'OpenAI-compatible' },
  zen:        { icon: '⚡', label: 'Zen (opencode.ai)' },
  groq:       { icon: '🔵', label: 'Groq' },
  openrouter: { icon: '🟠', label: 'OpenRouter' },
  cerebras:   { icon: '🔴', label: 'Cerebras' },
};

const PROVIDER_DEFAULTS = {
  ollama:     { baseURL: 'http://localhost:11434', apiKeyPlaceholder: 'Leave blank for local Ollama', apiKeyHint: 'optional — for authenticated/cloud Ollama', baseURLHint: 'Local default: http://localhost:11434 · Cloud: use your remote Ollama URL' },
  openai:     { baseURL: 'https://api.openai.com/v1', apiKeyPlaceholder: 'sk-...', apiKeyHint: 'required', baseURLHint: 'Default: https://api.openai.com/v1 · Change for compatible APIs' },
  zen:        { baseURL: 'https://opencode.ai/zen/v1', apiKeyPlaceholder: 'Your Zen API key', apiKeyHint: 'required — get from opencode.ai/zen', baseURLHint: 'Default: https://opencode.ai/zen/v1' },
  groq:       { baseURL: 'https://api.groq.com/openai/v1', apiKeyPlaceholder: 'gsk_...', apiKeyHint: 'required — get from console.groq.com', baseURLHint: 'Default: https://api.groq.com/openai/v1' },
  openrouter: { baseURL: 'https://openrouter.ai/api/v1', apiKeyPlaceholder: 'sk-or-...', apiKeyHint: 'required — get from openrouter.ai/keys', baseURLHint: 'Default: https://openrouter.ai/api/v1' },
  cerebras:   { baseURL: 'https://api.cerebras.ai/v1', apiKeyPlaceholder: 'csk-...', apiKeyHint: 'required — get from cloud.cerebras.ai', baseURLHint: 'Default: https://api.cerebras.ai/v1' },
};

// ── API helpers ───────────────────────────────────────────────────────────────

async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = message;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── Navigation ────────────────────────────────────────────────────────────────

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('view-' + btn.dataset.view).classList.add('active');
    if (btn.dataset.view === 'tools') loadTools();
    if (btn.dataset.view === 'settings') loadSettings();
    if (btn.dataset.view === 'mcp') loadMcpServers();
    if (btn.dataset.view === 'teams') loadTeams();
  });
});

// ── Providers ─────────────────────────────────────────────────────────────────

async function loadProviders() {
  try {
    [providers, config] = await Promise.all([
      api('GET', '/providers'),
      api('GET', '/config'),
    ]);
    renderProviders();
    updateSettingsProviderSelect();
  } catch (e) {
    toast('Failed to load instances: ' + e.message, 'error');
  }
}

function renderProviders() {
  const grid = document.getElementById('providers-grid');
  grid.querySelectorAll('.provider-card').forEach(c => c.remove());

  if (providers.length === 0) {
    document.getElementById('providers-empty').style.display = 'block';
    return;
  }
  document.getElementById('providers-empty').style.display = 'none';

  for (const p of providers) {
    const isActive = p.id === config.activeProvider;
    const meta = PROVIDER_META[p.type] || PROVIDER_META.openai;

    const card = document.createElement('div');
    card.className = `provider-card type-${p.type || 'ollama'}${isActive ? ' active-card' : ''}`;

    const badges = [];
    if (isActive) {
      badges.push('<span class="badge badge-current">● Active</span>');
    } else if (!p.enabled) {
      badges.push('<span class="badge badge-disabled">● Disabled</span>');
    }

    card.innerHTML = `
      <div class="provider-card-header">
        <div class="provider-info">
          <div class="provider-icon">${meta.icon}</div>
          <div>
            <div class="provider-name">${esc(p.name)}</div>
            <div class="provider-type">${meta.label}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          ${badges.join('')}
        </div>
      </div>
      <div class="provider-card-body">
        ${p.defaultModel ? `<div class="provider-detail"><span class="provider-detail-label">Model</span><span class="provider-detail-value">${esc(p.defaultModel)}</span></div>` : ''}
        ${p.baseURL ? `<div class="provider-detail"><span class="provider-detail-label">Endpoint</span><span class="provider-detail-value">${esc(p.baseURL)}</span></div>` : ''}
      </div>
      <div class="provider-card-footer">
        <button class="btn btn-secondary btn-sm" onclick="testCard('${p.id}', this)">Test</button>
        ${!isActive ? `<button class="btn btn-secondary btn-sm" onclick="setActive('${p.id}')">Set Active</button>` : '<span class="btn btn-sm" style="cursor:default;opacity:.5">✓ Active</span>'}
        <button class="btn btn-secondary btn-sm" onclick="editProvider('${p.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProvider('${p.id}')">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  }
}

async function testCard(id, btn) {
  const original = btn.textContent;
  btn.textContent = 'Testing…';
  btn.disabled = true;
  try {
    const result = await api('POST', `/providers/${id}/test`);
    toast(result.message, result.ok ? 'success' : 'error');
    btn.textContent = result.ok ? '✓ OK' : '✗ Failed';
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2500);
  } catch (e) {
    toast('Test failed: ' + e.message, 'error');
    btn.textContent = original;
    btn.disabled = false;
  }
}

async function setActive(id) {
  const provider = providers.find(p => p.id === id);
  if (!provider) return;
  try {
    await api('PATCH', '/config', { activeProvider: id, activeModel: provider.defaultModel || '' });
    config.activeProvider = id;
    config.activeModel = provider.defaultModel || '';
    renderProviders();
    updateSettingsProviderSelect();
    toast(`Active instance → ${provider.name}`, 'success');
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
}

async function deleteProvider(id) {
  const p = providers.find(p => p.id === id);
  if (!p || !confirm(`Delete provider "${p.name}"?`)) return;
  try {
    await api('DELETE', `/providers/${id}`);
    providers = providers.filter(p => p.id !== id);
    if (config.activeProvider === id) config.activeProvider = '';
    renderProviders();
    toast('Provider deleted', 'success');
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function onProviderTypeChange() {
  const type = document.getElementById('form-type').value;
  const defs = PROVIDER_DEFAULTS[type] || PROVIDER_DEFAULTS.openai;
  const meta = PROVIDER_META[type] || PROVIDER_META.openai;
  document.getElementById('modal-title').textContent = (editingId ? 'Edit ' : 'Add ') + meta.label;
  document.getElementById('form-baseurl').placeholder = defs.baseURL;
  document.getElementById('form-baseurl').value = defs.baseURL;
  document.getElementById('form-baseurl-hint').textContent = defs.baseURLHint;
  document.getElementById('form-apikey').placeholder = defs.apiKeyPlaceholder;
  document.getElementById('form-apikey-label').textContent = defs.apiKeyHint;
}

function showAddForm() {
  editingId = null;
  document.getElementById('provider-form').reset();
  document.getElementById('form-provider-id').value = '';
  document.getElementById('form-type').value = 'ollama';
  document.getElementById('form-enabled').checked = true;
  document.getElementById('test-result').style.display = 'none';
  document.getElementById('models-dropdown').style.display = 'none';
  onProviderTypeChange();
  showModal();
}

function editProvider(id) {
  const p = providers.find(p => p.id === id);
  if (!p) return;
  editingId = id;
  const meta = PROVIDER_META[p.type] || PROVIDER_META.openai;
  document.getElementById('modal-title').textContent = 'Edit ' + meta.label;
  document.getElementById('form-provider-id').value = id;
  document.getElementById('form-type').value = p.type || 'ollama';
  document.getElementById('form-name').value = p.name;
  const defs = PROVIDER_DEFAULTS[p.type] || PROVIDER_DEFAULTS.openai;
  document.getElementById('form-baseurl').value = p.baseURL || defs.baseURL;
  document.getElementById('form-baseurl-hint').textContent = defs.baseURLHint;
  document.getElementById('form-apikey').value = p.apiKey || '';
  document.getElementById('form-apikey').placeholder = defs.apiKeyPlaceholder;
  document.getElementById('form-apikey-label').textContent = defs.apiKeyHint;
  document.getElementById('form-defaultmodel').value = p.defaultModel || '';
  document.getElementById('form-enabled').checked = p.enabled !== false;
  document.getElementById('test-result').style.display = 'none';
  document.getElementById('models-dropdown').style.display = 'none';
  showModal();
}

function showModal() {
  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  editingId = null;
}

document.getElementById('modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// ── Save instance ─────────────────────────────────────────────────────────────

function getFormBody() {
  const name = document.getElementById('form-name').value.trim();
  const baseURL = document.getElementById('form-baseurl').value.trim();
  const apiKey = document.getElementById('form-apikey').value.trim();
  const defaultModel = document.getElementById('form-defaultmodel').value.trim();
  const enabled = document.getElementById('form-enabled').checked;
  const type = document.getElementById('form-type').value;
  return { type, name, baseURL, apiKey, defaultModel, enabled };
}

function toggleApiKey() {
  const input = document.getElementById('form-apikey');
  const btn = document.querySelector('.toggle-visibility');
  if (input.type === 'password') { input.type = 'text'; btn.textContent = 'Hide'; }
  else { input.type = 'password'; btn.textContent = 'Show'; }
}

async function saveProvider() {
  const { type, name, baseURL, apiKey, defaultModel, enabled } = getFormBody();

  if (!name) { toast('Please enter a display name', 'error'); return; }

  const body = { type, name, enabled };
  if (baseURL) body.baseURL = baseURL;
  if (apiKey && !apiKey.startsWith('***')) body.apiKey = apiKey;
  if (defaultModel) body.defaultModel = defaultModel;

  try {
    if (editingId) {
      const updated = await api('PUT', `/providers/${editingId}`, body);
      providers = providers.map(p => p.id === editingId ? updated : p);
      toast('Provider updated', 'success');
    } else {
      const created = await api('POST', '/providers', body);
      providers.push(created);
      editingId = created.id;
      toast('Provider added — you can now test connection or list models', 'success');
    }
    renderProviders();
    updateSettingsProviderSelect();
    closeModal();
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

// ── Test connection (modal) ────────────────────────────────────────────────────

async function testProvider() {
  const resultEl = document.getElementById('test-result');
  const btn = document.getElementById('btn-test');
  btn.textContent = 'Testing…';
  btn.disabled = true;
  resultEl.style.display = 'none';

  try {
    let result;
    if (editingId) {
      result = await api('POST', `/providers/${editingId}/test`);
    } else {
      const { type, name, baseURL, apiKey, defaultModel, enabled } = getFormBody();
      const body = { type, name, baseURL, defaultModel, enabled };
      if (apiKey && !apiKey.startsWith('***')) body.apiKey = apiKey;
      result = await api('POST', '/providers/test-inline', body);
    }
    const type = document.getElementById('form-type').value;
    const failHint = !result.ok ? (type === 'ollama' ? ' — is Ollama running? Try: ollama serve' : ' — check your API key and base URL') : '';
    resultEl.textContent = (result.ok ? '✓ ' : '✗ ') + result.message + failHint;
    resultEl.className = `test-result ${result.ok ? 'success' : 'error'}`;
    resultEl.style.display = 'block';
  } catch (e) {
    resultEl.textContent = '✗ ' + e.message;
    resultEl.className = 'test-result error';
    resultEl.style.display = 'block';
  }

  btn.textContent = 'Test Connection';
  btn.disabled = false;
}

// ── List models (modal) ───────────────────────────────────────────────────────

async function listModels() {
  const dropdown = document.getElementById('models-dropdown');
  dropdown.innerHTML = '<div style="padding:10px;color:var(--text-muted)">Loading models…</div>';
  dropdown.style.display = 'block';

  try {
    let models;
    if (editingId) {
      models = await api('GET', `/providers/${editingId}/models`);
    } else {
      const { type, name, baseURL, apiKey, defaultModel, enabled } = getFormBody();
      const body = { type, name, baseURL, defaultModel, enabled };
      if (apiKey && !apiKey.startsWith('***')) body.apiKey = apiKey;
      models = await api('POST', '/providers/list-models-inline', body);
    }

    let html = '';
    models.forEach(m => {
      html += `<div class="model-option" onclick="selectModel('${esc(m.id)}')">
        <div class="model-option-name">${esc(m.id)}</div>
        <div class="model-option-ctx">${m.name !== m.id ? esc(m.name || '') : ''}</div>
      </div>`;
    });

    if (html) {
      dropdown.innerHTML = html;
    } else {
      const type = document.getElementById('form-type').value;
      const noModelsMsg = type === 'ollama'
        ? `No models found. Make sure Ollama is running:<br><code style="color:var(--cyan)">ollama serve</code><br><br>Then pull a model, e.g.:<br><code style="color:var(--cyan)">ollama pull qwen2.5-coder</code>`
        : `No models returned. Check that your API key and base URL are correct.`;
      dropdown.innerHTML = `<div style="padding:12px;color:var(--warning);font-size:12px;line-height:1.6">${noModelsMsg}</div>`;
    }
  } catch (e) {
    const t = document.getElementById('form-type').value;
    const errHint = t === 'ollama' ? '<br><br>Make sure Ollama is running (<code style="color:var(--cyan)">ollama serve</code>) and the base URL is correct.' : '<br><br>Check your API key and base URL.';
    dropdown.innerHTML = `<div style="padding:10px;color:var(--error);font-size:12px;line-height:1.6">${esc(e.message)}${errHint}</div>`;
  }
}

function selectModel(id) {
  document.getElementById('form-defaultmodel').value = id;
  document.getElementById('models-dropdown').style.display = 'none';
}

// ── Settings ──────────────────────────────────────────────────────────────────

async function loadSettings() {
  try {
    config = await api('GET', '/config');
    document.getElementById('setting-active-model').value = config.activeModel || '';
    document.getElementById('setting-max-tokens').value = config.maxTokens || 8192;
    document.getElementById('setting-temperature').value = config.temperature || 0;
    document.getElementById('setting-temperature-val').textContent = (config.temperature || 0).toFixed(2);
    document.getElementById('setting-multi-agent').checked = config.multiAgent || false;
    updateSettingsProviderSelect();
  } catch (e) {
    toast('Failed to load settings', 'error');
  }
}

function updateSettingsProviderSelect() {
  const sel = document.getElementById('setting-active-provider');
  if (!sel) return;
  const current = config.activeProvider;
  sel.innerHTML = '<option value="">— None —</option>' +
    providers.map(p => `<option value="${p.id}"${p.id === current ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
}

document.getElementById('setting-temperature').addEventListener('input', (e) => {
  document.getElementById('setting-temperature-val').textContent = parseFloat(e.target.value).toFixed(2);
});

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  try {
    await api('PATCH', '/config', {
      activeProvider: document.getElementById('setting-active-provider').value || null,
      activeModel: document.getElementById('setting-active-model').value,
      maxTokens: parseInt(document.getElementById('setting-max-tokens').value, 10),
      temperature: parseFloat(document.getElementById('setting-temperature').value),
      multiAgent: document.getElementById('setting-multi-agent').checked,
    });
    config = await api('GET', '/config');
    renderProviders();
    toast('Settings saved', 'success');
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
});

// ── Tools ─────────────────────────────────────────────────────────────────────

async function loadTools() {
  const list = document.getElementById('tools-list');
  list.innerHTML = '<p style="color:var(--text-muted);padding:20px">Loading tools...</p>';
  try {
    const tools = await api('GET', '/tools');
    const TOOL_ICONS = {
      bash: '💻', read: '📖', write: '✏️', edit: '🔧',
      glob: '🔍', grep: '🔎', web_fetch: '🌐', list_dir: '📁', http_request: '🔗',
    };
    list.innerHTML = tools.map(t => `
      <div class="tool-card">
        <div class="tool-icon">${TOOL_ICONS[t.name] || '⚙️'}</div>
        <div>
          <div class="tool-name">${esc(t.name)}</div>
          <div class="tool-desc">${esc(t.description)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = `<p style="color:var(--error)">Failed to load tools: ${esc(e.message)}</p>`;
  }
}

// ── MCP Servers ───────────────────────────────────────────────────────────────

async function loadMcpServers() {
  try {
    mcpServers = await api('GET', '/mcp');
    renderMcpServers();
  } catch (e) {
    toast('Failed to load MCP servers: ' + e.message, 'error');
  }
}

function renderMcpServers() {
  const grid = document.getElementById('mcp-grid');
  grid.querySelectorAll('.provider-card').forEach(c => c.remove());

  if (mcpServers.length === 0) {
    document.getElementById('mcp-empty').style.display = 'block';
    return;
  }
  document.getElementById('mcp-empty').style.display = 'none';

  for (const s of mcpServers) {
    const card = document.createElement('div');
    card.className = 'provider-card' + (s.enabled ? '' : ' disabled-card');

    const badge = s.enabled
      ? '<span class="badge badge-current">● Enabled</span>'
      : '<span class="badge badge-disabled">● Disabled</span>';

    const detail = s.transport === 'stdio'
      ? `<div class="provider-detail"><span class="provider-detail-label">Command</span><span class="provider-detail-value">${esc(s.command || '')} ${esc((s.args || []).join(' '))}</span></div>`
      : `<div class="provider-detail"><span class="provider-detail-label">URL</span><span class="provider-detail-value">${esc(s.url || '')}</span></div>`;

    card.innerHTML = `
      <div class="provider-card-header">
        <div class="provider-info">
          <div class="provider-icon">🔌</div>
          <div>
            <div class="provider-name">${esc(s.name)}</div>
            <div class="provider-type">${s.transport === 'stdio' ? 'stdio' : 'http'}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">${badge}</div>
      </div>
      <div class="provider-card-body">${detail}</div>
      <div class="provider-card-footer">
        <button class="btn btn-secondary btn-sm" onclick="testMcpCard('${s.id}', this)">Test</button>
        <button class="btn btn-secondary btn-sm" onclick="editMcpServer('${s.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteMcpServer('${s.id}')">Delete</button>
      </div>
    `;
    grid.appendChild(card);
  }
}

async function testMcpCard(id, btn) {
  const original = btn.textContent;
  btn.textContent = 'Testing…';
  btn.disabled = true;
  try {
    const result = await api('POST', `/mcp/${id}/test`);
    toast(result.message, result.ok ? 'success' : 'error');
    btn.textContent = result.ok ? '✓ OK' : '✗ Failed';
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 2500);
  } catch (e) {
    toast('Test failed: ' + e.message, 'error');
    btn.textContent = original;
    btn.disabled = false;
  }
}

async function deleteMcpServer(id) {
  const s = mcpServers.find(s => s.id === id);
  if (!s || !confirm(`Delete MCP server "${s.name}"?`)) return;
  try {
    await api('DELETE', `/mcp/${id}`);
    mcpServers = mcpServers.filter(s => s.id !== id);
    renderMcpServers();
    toast('MCP server deleted', 'success');
  } catch (e) {
    toast('Delete failed: ' + e.message, 'error');
  }
}

function showAddMcp() {
  editingMcpId = null;
  document.getElementById('mcp-modal-title').textContent = 'Add MCP Server';
  document.getElementById('mcp-form').reset();
  document.getElementById('mcp-form-id').value = '';
  document.getElementById('mcp-form-transport').value = 'stdio';
  document.getElementById('mcp-form-enabled').checked = true;
  document.getElementById('mcp-test-result').style.display = 'none';
  onMcpTransportChange();
  document.getElementById('mcp-modal-overlay').style.display = 'flex';
}

function editMcpServer(id) {
  const s = mcpServers.find(s => s.id === id);
  if (!s) return;
  editingMcpId = id;
  document.getElementById('mcp-modal-title').textContent = 'Edit MCP Server';
  document.getElementById('mcp-form-id').value = id;
  document.getElementById('mcp-form-name').value = s.name;
  document.getElementById('mcp-form-transport').value = s.transport || 'stdio';
  document.getElementById('mcp-form-command').value = s.command || '';
  document.getElementById('mcp-form-args').value = (s.args || []).join('\n');
  document.getElementById('mcp-form-env').value = Object.entries(s.env || {}).map(([k, v]) => `${k}=${v}`).join('\n');
  document.getElementById('mcp-form-url').value = s.url || '';
  document.getElementById('mcp-form-enabled').checked = s.enabled !== false;
  document.getElementById('mcp-test-result').style.display = 'none';
  onMcpTransportChange();
  document.getElementById('mcp-modal-overlay').style.display = 'flex';
}

function closeMcpModal() {
  document.getElementById('mcp-modal-overlay').style.display = 'none';
  editingMcpId = null;
}

document.getElementById('mcp-modal-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeMcpModal();
});

function onMcpTransportChange() {
  const t = document.getElementById('mcp-form-transport').value;
  document.getElementById('mcp-stdio-fields').style.display = t === 'stdio' ? '' : 'none';
  document.getElementById('mcp-http-fields').style.display = t === 'http' ? '' : 'none';
}

function getMcpFormBody() {
  const transport = document.getElementById('mcp-form-transport').value;
  const args = document.getElementById('mcp-form-args').value
    .split('\n').map(l => l.trim()).filter(Boolean);
  const envLines = document.getElementById('mcp-form-env').value
    .split('\n').map(l => l.trim()).filter(Boolean);
  const env = Object.fromEntries(envLines.map(l => {
    const i = l.indexOf('=');
    return i >= 0 ? [l.slice(0, i), l.slice(i + 1)] : [l, ''];
  }));
  return {
    name: document.getElementById('mcp-form-name').value.trim(),
    transport,
    command: document.getElementById('mcp-form-command').value.trim() || undefined,
    args,
    env,
    url: document.getElementById('mcp-form-url').value.trim() || undefined,
    enabled: document.getElementById('mcp-form-enabled').checked,
  };
}

async function saveMcpServer() {
  const body = getMcpFormBody();
  if (!body.name) { toast('Please enter a display name', 'error'); return; }
  if (body.transport === 'stdio' && !body.command) { toast('Please enter a command', 'error'); return; }
  if (body.transport === 'http' && !body.url) { toast('Please enter a URL', 'error'); return; }

  try {
    if (editingMcpId) {
      const updated = await api('PUT', `/mcp/${editingMcpId}`, body);
      mcpServers = mcpServers.map(s => s.id === editingMcpId ? updated : s);
      toast('MCP server updated', 'success');
    } else {
      const created = await api('POST', '/mcp', body);
      mcpServers.push(created);
      toast('MCP server added', 'success');
    }
    renderMcpServers();
    closeMcpModal();
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

async function testMcpServer() {
  const resultEl = document.getElementById('mcp-test-result');
  const btn = document.getElementById('btn-test-mcp');
  btn.textContent = 'Testing…';
  btn.disabled = true;
  resultEl.style.display = 'none';

  try {
    let result;
    if (editingMcpId) {
      result = await api('POST', `/mcp/${editingMcpId}/test`);
    } else {
      result = await api('POST', '/mcp/test-inline', getMcpFormBody());
    }
    resultEl.textContent = (result.ok ? '✓ ' : '✗ ') + result.message;
    resultEl.className = `test-result ${result.ok ? 'success' : 'error'}`;
    resultEl.style.display = 'block';
  } catch (e) {
    resultEl.textContent = '✗ ' + e.message;
    resultEl.className = 'test-result error';
    resultEl.style.display = 'block';
  }

  btn.textContent = 'Test Connection';
  btn.disabled = false;
}

// ── Wiring ────────────────────────────────────────────────────────────────────

document.getElementById('btn-add-provider').addEventListener('click', showAddForm);
document.getElementById('btn-add-mcp').addEventListener('click', showAddMcp);

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Teams ─────────────────────────────────────────────────────────────────────

async function loadTeams() {
  try {
    const data = await api('GET', '/teams');
    teams = data.teams ?? [];
    activeTeam = data.activeTeam ?? null;
    renderTeams();
  } catch (e) {
    console.error('Failed to load teams', e);
  }
}

function renderTeams() {
  const list = document.getElementById('teams-list');
  if (!teams.length) {
    list.innerHTML = `<div class="empty-state" style="display:block">
      <div class="empty-icon">👥</div>
      <h3>No teams configured</h3>
      <p>Create a team to group providers with specific roles and tool restrictions</p>
      <button class="btn btn-primary" onclick="showAddTeam()">+ New Team</button>
    </div>`;
    return;
  }
  list.innerHTML = teams.map(team => {
    const isActive = team.id === activeTeam;
    const orchProvider = providers.find(p => p.id === team.orchestratorProviderId);
    const orchLabel = orchProvider ? `${orchProvider.name} / ${team.orchestratorModel}` : team.orchestratorModel;
    return `<div class="team-card ${isActive ? 'active' : ''}">
      <div class="team-card-header">
        <span class="team-card-name">${esc(team.name)}</span>
        ${isActive ? '<span class="team-active-badge">Active</span>' : ''}
        <label class="checkbox-label" style="margin:0">
          <input type="checkbox" ${team.enabled ? 'checked' : ''} onchange="toggleTeamEnabled('${team.id}', this.checked)">
          <span>Enabled</span>
        </label>
      </div>
      ${team.description ? `<div class="team-card-desc">${esc(team.description)}</div>` : ''}
      <div class="team-orchestrator">Orchestrator: ${esc(orchLabel)}</div>
      <div class="team-members-grid">
        ${team.members.map(m => `
          <div class="team-member-row">
            <span class="team-member-name">${esc(m.name)}</span>
            <span class="team-member-role">${esc(m.role)}</span>
            <span class="team-member-tools">${m.tools.length ? m.tools.join(', ') : 'all tools'}</span>
          </div>`).join('')}
      </div>
      <div class="team-card-actions">
        ${isActive
          ? `<button class="btn btn-secondary btn-sm" onclick="setActiveTeam(null)">Deactivate</button>`
          : `<button class="btn btn-primary btn-sm" onclick="setActiveTeam('${team.id}')">Set Active</button>`}
        <button class="btn btn-secondary btn-sm" onclick="editTeam('${team.id}')">Edit</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteTeam('${team.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

async function setActiveTeam(teamId) {
  try {
    await api('PATCH', '/teams/active', { teamId });
    activeTeam = teamId;
    renderTeams();
    toast(teamId ? 'Team activated' : 'Team deactivated', 'success');
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
}

async function toggleTeamEnabled(id, enabled) {
  try {
    const team = teams.find(t => t.id === id);
    if (!team) return;
    const updated = await api('PUT', `/teams/${id}`, { ...team, enabled });
    teams = teams.map(t => t.id === id ? updated : t);
    renderTeams();
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
}

async function deleteTeam(id) {
  if (!confirm('Delete this team?')) return;
  try {
    await api('DELETE', `/teams/${id}`);
    teams = teams.filter(t => t.id !== id);
    if (activeTeam === id) activeTeam = null;
    renderTeams();
    toast('Team deleted', 'success');
  } catch (e) {
    toast('Failed: ' + e.message, 'error');
  }
}

async function showAddTeam() {
  editingTeamId = null;
  teamMembers = [];
  document.getElementById('team-modal-title').textContent = 'New Team';
  document.getElementById('team-form-id').value = '';
  document.getElementById('team-form-name').value = '';
  document.getElementById('team-form-desc').value = '';
  document.getElementById('team-form-orch-model').innerHTML = '<option value="">— Select provider first —</option>';
  populateTeamProviderSelects();
  await ensureToolsLoaded();
  renderTeamMemberEditors();
  document.getElementById('team-modal-overlay').style.display = 'flex';
}

async function editTeam(id) {
  const team = teams.find(t => t.id === id);
  if (!team) return;
  editingTeamId = id;
  teamMembers = team.members.map(m => ({ ...m }));
  document.getElementById('team-modal-title').textContent = 'Edit Team';
  document.getElementById('team-form-id').value = team.id;
  document.getElementById('team-form-name').value = team.name;
  document.getElementById('team-form-desc').value = team.description ?? '';
  populateTeamProviderSelects();
  document.getElementById('team-form-orch-provider').value = team.orchestratorProviderId;
  await ensureToolsLoaded();
  renderTeamMemberEditors();
  loadOrchModelSelect(team.orchestratorProviderId, team.orchestratorModel);
  document.getElementById('team-modal-overlay').style.display = 'flex';
}

function closeTeamModal() {
  document.getElementById('team-modal-overlay').style.display = 'none';
}

function populateTeamProviderSelects() {
  const sel = document.getElementById('team-form-orch-provider');
  const opts = providers.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  sel.innerHTML = '<option value="">— Select provider —</option>' + opts;
}

async function ensureToolsLoaded() {
  if (allTools.length) return;
  try { allTools = await api('GET', '/tools'); } catch {}
}

async function fetchProviderModels(pid) {
  if (!pid) return [];
  if (modelsCache[pid]) return modelsCache[pid];
  try {
    const models = await api('GET', `/providers/${pid}/models`);
    modelsCache[pid] = models;
    return models;
  } catch { return []; }
}

async function loadOrchModelSelect(pid, currentModel) {
  const sel = document.getElementById('team-form-orch-model');
  if (!pid) { sel.innerHTML = '<option value="">— Select provider first —</option>'; return; }
  sel.innerHTML = '<option value="">Loading…</option>';
  const models = await fetchProviderModels(pid);
  if (!models.length) { sel.innerHTML = `<option value="${esc(currentModel||'')}" selected>${esc(currentModel||'No models found')}</option>`; return; }
  sel.innerHTML = models.map(m => `<option value="${esc(m.id)}" ${m.id === currentModel ? 'selected' : ''}>${esc(m.id)}</option>`).join('');
  if (currentModel && !models.find(m => m.id === currentModel)) {
    sel.innerHTML += `<option value="${esc(currentModel)}" selected>${esc(currentModel)}</option>`;
  }
}

async function onTeamOrchProviderChange() {
  const pid = document.getElementById('team-form-orch-provider').value;
  await loadOrchModelSelect(pid, '');
}

async function populateMemberModelSelect(idx, currentModel) {
  const pid = teamMembers[idx]?.providerId;
  const sel = document.getElementById(`member-model-${idx}`);
  if (!sel) return;
  if (!pid) { sel.innerHTML = '<option value="">— Select provider first —</option>'; return; }
  sel.innerHTML = '<option value="">Loading…</option>';
  const models = await fetchProviderModels(pid);
  if (!models.length) { sel.innerHTML = `<option value="${esc(currentModel||'')}" selected>${esc(currentModel||'No models found')}</option>`; return; }
  sel.innerHTML = models.map(m => `<option value="${esc(m.id)}" ${m.id === currentModel ? 'selected' : ''}>${esc(m.id)}</option>`).join('');
  if (currentModel && !models.find(m => m.id === currentModel)) {
    sel.innerHTML += `<option value="${esc(currentModel)}" selected>${esc(currentModel)}</option>`;
  }
}

async function onMemberProviderChange(idx) {
  teamMembers[idx].model = '';
  await populateMemberModelSelect(idx, '');
}

function addTeamMember() {
  teamMembers.push({ id: 'member-' + Date.now(), name: '', role: '', providerId: '', model: '', tools: [] });
  renderTeamMemberEditors();
}

function removeTeamMember(idx) {
  teamMembers.splice(idx, 1);
  renderTeamMemberEditors();
}

function renderTeamMemberEditors() {
  const container = document.getElementById('team-members-list');
  if (!teamMembers.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:8px 0">No members yet. Add a member to assign roles and tools.</p>';
    return;
  }
  container.innerHTML = teamMembers.map((m, i) => `
    <div class="team-member-editor">
      <button type="button" class="remove-btn" onclick="removeTeamMember(${i})">✕</button>
      <div class="team-member-grid">
        <div class="form-group">
          <label>Name <span class="required">*</span></label>
          <input type="text" value="${esc(m.name)}" placeholder="e.g. Git Analyst"
            oninput="teamMembers[${i}].name=this.value">
        </div>
        <div class="form-group">
          <label>Provider</label>
          <select onchange="teamMembers[${i}].providerId=this.value;onMemberProviderChange(${i})">
            <option value="">— Select —</option>
            ${providers.map(p => `<option value="${p.id}" ${m.providerId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Role / Responsibility</label>
          <input type="text" value="${esc(m.role)}" placeholder="e.g. Analyze git history and diffs"
            oninput="teamMembers[${i}].role=this.value">
        </div>
        <div class="form-group">
          <label>Model</label>
          <select id="member-model-${i}" onchange="teamMembers[${i}].model=this.value">
            <option value="">— Select provider first —</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top:8px;margin-bottom:0">
        <label>Allowed Tools <span class="hint">leave all unchecked for unrestricted access</span></label>
        <div class="tools-checkbox-list">${renderToolCheckboxes(i, m.tools)}</div>
      </div>
    </div>`).join('');
  // Async-populate model selects for members that already have a provider
  teamMembers.forEach((m, i) => { if (m.providerId) populateMemberModelSelect(i, m.model); });
}

const TOOL_CATEGORIES = {
  'File System':    ['read_file','write_file','edit_file','list_files','delete_file'],
  'Search':         ['glob_search','grep_search','search_symbol','docs_search'],
  'Shell':          ['bash','run_script'],
  'Git':            ['git_status','git_diff','git_add','git_commit','git_log'],
  'Web':            ['web_fetch','web_search'],
  'Build':          ['run_tests','build_project','lint_code'],
  'Infrastructure': ['docker_exec','docker_logs','k8s_apply'],
  'Database':       ['db_query','db_schema'],
  'Agent / Memory': ['think','memory_save','memory_get','task_create','task_update'],
  'Safety':         ['confirm_action','block_command'],
  'Embeddings':     ['generate_embeddings'],
};

function getToolCategory(toolName) {
  if (toolName.startsWith('mcp__')) {
    const parts = toolName.split('__');
    return 'MCP · ' + (parts[1] || 'unknown').replace(/_/g, ' ');
  }
  for (const [cat, names] of Object.entries(TOOL_CATEGORIES)) {
    if (names.includes(toolName)) return cat;
  }
  return 'Other';
}

function renderToolCheckboxes(memberIdx, selectedTools) {
  const grouped = {};
  for (const t of allTools) {
    const cat = getToolCategory(t.name);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(t);
  }
  // Sort categories: built-ins first in defined order, then MCP by server, then Other
  const builtinOrder = [...Object.keys(TOOL_CATEGORIES), 'Other'];
  const cats = Object.keys(grouped).sort((a, b) => {
    const ai = a.startsWith('MCP') ? 999 : builtinOrder.indexOf(a);
    const bi = b.startsWith('MCP') ? 999 : builtinOrder.indexOf(b);
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
  return cats.map(cat => `
    <div class="tool-category">
      <div class="tool-category-header">
        <span class="tool-category-label">${esc(cat)}</span>
        <label class="tool-category-select-all">
          <input type="checkbox"
            ${grouped[cat].every(t => (selectedTools||[]).includes(t.name)) ? 'checked' : ''}
            onchange="onCategoryToggle(${memberIdx},'${esc(cat)}',this.checked)">
          all
        </label>
      </div>
      <div class="tool-category-items">
        ${grouped[cat].map(t => `
          <label class="tool-checkbox-item">
            <input type="checkbox" ${(selectedTools||[]).includes(t.name)?'checked':''}
              onchange="onMemberToolToggle(${memberIdx},'${t.name}')">
            <span title="${esc(t.description||'')}">${esc(t.name.startsWith('mcp__') ? t.name.split('__').slice(2).join('__') : t.name)}</span>
          </label>`).join('')}
      </div>
    </div>`).join('');
}

function onCategoryToggle(memberIdx, cat, checked) {
  const grouped = {};
  for (const t of allTools) {
    const c = getToolCategory(t.name);
    if (!grouped[c]) grouped[c] = [];
    grouped[c].push(t);
  }
  const catTools = (grouped[cat] || []).map(t => t.name);
  const tools = teamMembers[memberIdx].tools || [];
  if (checked) {
    for (const n of catTools) { if (!tools.includes(n)) tools.push(n); }
  } else {
    teamMembers[memberIdx].tools = tools.filter(n => !catTools.includes(n));
    return;
  }
  teamMembers[memberIdx].tools = tools;
}

function onMemberToolToggle(idx, toolName) {
  const tools = teamMembers[idx].tools || [];
  const pos = tools.indexOf(toolName);
  if (pos === -1) tools.push(toolName);
  else tools.splice(pos, 1);
  teamMembers[idx].tools = tools;
}

async function saveTeam() {
  const name = document.getElementById('team-form-name').value.trim();
  const orchProvider = document.getElementById('team-form-orch-provider').value;
  const orchModel = document.getElementById('team-form-orch-model').value.trim();
  if (!name || !orchProvider || !orchModel) {
    toast('Name, orchestrator provider and model are required', 'error'); return;
  }
  const body = {
    name,
    description: document.getElementById('team-form-desc').value.trim(),
    orchestratorProviderId: orchProvider,
    orchestratorModel: orchModel,
    enabled: true,
    members: teamMembers.filter(m => m.name),
  };
  try {
    if (editingTeamId) {
      const updated = await api('PUT', `/teams/${editingTeamId}`, body);
      teams = teams.map(t => t.id === editingTeamId ? updated : t);
      toast('Team updated', 'success');
    } else {
      const created = await api('POST', '/teams', body);
      teams.push(created);
      toast('Team created', 'success');
    }
    renderTeams();
    closeTeamModal();
  } catch (e) {
    toast('Save failed: ' + e.message, 'error');
  }
}

// ── Update check ──────────────────────────────────────────────────────────────

let _pendingLatest = null;

async function checkForUpdate() {
  try {
    const data = await api('GET', '/version');
    if (!data.updateAvailable) return;
    // Don't re-show banner if the user already updated to this version this session
    if (localStorage.getItem('manthra_updated_to') === data.latest) return;
    _pendingLatest = data.latest;
    document.getElementById('update-banner-msg').textContent =
      `Update available: v${data.current} → v${data.latest}` + (data.date ? `  —  ${data.date}` : '');
    document.getElementById('update-banner').style.display = 'flex';
  } catch {
    // silently ignore
  }
}

async function doUpdate() {
  const modal = document.getElementById('update-modal');
  const spinner = document.getElementById('update-spinner');
  const result = document.getElementById('update-modal-result');
  const footer = document.getElementById('update-modal-footer');
  const btn = document.getElementById('btn-update-now');

  modal.style.display = 'flex';
  spinner.style.display = 'block';
  result.style.display = 'none';
  footer.style.display = 'none';
  btn.disabled = true;

  try {
    const data = await api('POST', '/update');
    spinner.style.display = 'none';
    result.style.display = 'block';
    footer.style.display = 'block';
    if (data.ok) {
      if (_pendingLatest) localStorage.setItem('manthra_updated_to', _pendingLatest);
      result.textContent = '✓ ' + data.message;
      result.style.color = 'var(--success)';
      document.getElementById('update-banner').style.display = 'none';
    } else {
      result.textContent = '✗ ' + data.message;
      result.style.color = 'var(--error)';
      btn.disabled = false;
    }
  } catch (e) {
    spinner.style.display = 'none';
    result.style.display = 'block';
    result.textContent = '✗ ' + e.message;
    result.style.color = 'var(--error)';
    footer.style.display = 'block';
    btn.disabled = false;
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

loadProviders();
checkForUpdate();
