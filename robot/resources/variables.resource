*** Settings ***
Documentation       Globals shared by the browser suites (via common.resource)
...                 and the browser-free API suites (via api.resource).


*** Variables ***
${BASE_URL}         http://localhost:3000
# Storage states minted by e2e/global-setup.ts (via scripts/mint-e2e-auth.ts).
${OWNER_STATE}      ${CURDIR}/../../e2e/.auth/user.json
${OTHER_STATE}      ${CURDIR}/../../e2e/.auth/user2.json
