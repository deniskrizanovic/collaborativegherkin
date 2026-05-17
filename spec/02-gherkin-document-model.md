# 2. The Gherkin Document Model

## 2.1 Block types

A Gherkin document is composed of typed blocks. Each block has a keyword type and free-form text. The valid types are:

| Type       | Keyword prefix |
|------------|----------------|
| feature    | Feature        |
| rule       | Rule           |
| background | Background     |
| scenario   | Scenario       |
| given      | Given          |
| when       | When           |
| then       | Then           |
| and        | And            |
| but        | But            |

---

## 2.2 Document structure rules

These rules govern which block type may follow another. They are enforced by `canFollow()` in `src/lib/gherkin.ts` and apply everywhere in the application — editor toolbar, slash-command menu, and Enter-key auto-progression.

**Given** the document is empty  
**Then** the only valid first block type is `feature`

**Given** the current block is `feature`  
**Then** the valid next block types are: `rule`, `background`, `scenario`

**Given** the current block is `rule`  
**Then** the valid next block types are: `background`, `scenario`

**Given** the current block is `background`  
**Then** the only valid next block type is `given`

**Given** the current block is `scenario`  
**Then** the only valid next block type is `given`

**Given** the current block is `given`  
**Then** the valid next block types are: `given`, `when`, `and`, `but`

**Given** the current block is `when`  
**Then** the valid next block types are: `when`, `then`, `and`, `but`

**Given** the current block is `then`  
**Then** the valid next block types are: `then`, `and`, `but`, `scenario`, `rule`

**Given** the current block is `and`  
**Then** the valid next block types are: `given`, `when`, `then`, `and`, `but`, `scenario`, `rule`

**Given** the current block is `but`  
**Then** the valid next block types are: `given`, `when`, `then`, `and`, `but`, `scenario`, `rule`
