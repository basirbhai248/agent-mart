# AgentMart CLI

Install globally:

```bash
npm install -g agentmart
```

## Usage

```bash
agentmart register --wallet 0xabc123... --name "Alice" --bio "Independent agent developer"
agentmart recover --wallet 0xabc123... --signature "0xsignature..."
agentmart upload ./storage-id.txt --title "Market Signals" --description "Daily alpha feed" --price 5 --api-key am_live_123
agentmart search "market signals"
agentmart list --creator 0xabc123...
agentmart buy listing_123 --output ./downloads/listing_123.txt
agentmart me
agentmart updates
agentmart config set private-key 0xyourprivatekey
```
