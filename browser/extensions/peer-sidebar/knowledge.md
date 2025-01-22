# Peer Sidebar Extension

## Known Issues

### CORS Configuration
The backend at localhost:8000 needs CORS headers to allow requests from the extension. 
Backend should add:
```
Access-Control-Allow-Origin: moz-extension://*
Access-Control-Allow-Methods: GET
```

Currently using `mode: 'no-cors'` as temporary workaround.

## Development Notes
- Polling interval: 3s (dev), 30s (prod)
- Background script manages state and polling
- Panel script handles UI only
