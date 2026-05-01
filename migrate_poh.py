import os
import re

files = [
    "apps/processorderhistory/backend/routers/adherence_router.py",
    "apps/processorderhistory/backend/routers/day_view_router.py",
    "apps/processorderhistory/backend/routers/downtime_router.py",
    "apps/processorderhistory/backend/routers/equipment_insights_router.py",
    "apps/processorderhistory/backend/routers/me_router.py",
    "apps/processorderhistory/backend/routers/oee_router.py",
    "apps/processorderhistory/backend/routers/order_detail_router.py",
    "apps/processorderhistory/backend/routers/planning_router.py",
    "apps/processorderhistory/backend/routers/pours_router.py",
    "apps/processorderhistory/backend/routers/quality_router.py",
    "apps/processorderhistory/backend/routers/vessel_planning_router.py",
    "apps/processorderhistory/backend/routers/yield_router.py",
]

for file_path in files:
    if not os.path.exists(file_path):
        print(f"Skipping {file_path}, not found.")
        continue
        
    with open(file_path, "r") as f:
        content = f.read()

    # 1. Update imports
    if "from fastapi import" in content:
        if "Depends" not in content:
            content = re.sub(r"from fastapi import (.*)", r"from fastapi import Depends, \1", content)
    
    if "from shared_auth import UserIdentity, require_user" not in content:
        # Insert after other imports or at top
        import_match = re.search(r"from (fastapi|backend|pydantic) import", content)
        if import_match:
            content = content[:import_match.start()] + "from shared_auth import UserIdentity, require_user\n" + content[import_match.start():]
        else:
            content = "from shared_auth import UserIdentity, require_user\n" + content

    # Remove resolve_token from imports
    content = re.sub(r",\s*resolve_token", "", content)
    content = re.sub(r"resolve_token,\s*", "", content)
    content = re.sub(r"from backend\.db import resolve_token\n", "", content)
    content = re.sub(r"from backend\.utils\.db import resolve_token\n", "", content)

    # 2. Update route handlers
    def replace_handler(match):
        func_name = match.group(1)
        args = match.group(2)
        
        if "x_forwarded_access_token" in args or "authorization" in args:
            # Remove old headers
            args = re.sub(r"\s*x_forwarded_access_token:\s*Optional\[str\]\s*=\s*Header\(default=None\),?", "", args)
            args = re.sub(r"\s*authorization:\s*Optional\[str\]\s*=\s*Header\(default=None\),?", "", args)
            
            # Add user
            if "user: UserIdentity = Depends(require_user)" not in args:
                args = args.strip()
                if args and not args.endswith(","):
                    args += ","
                args += "\n    user: UserIdentity = Depends(require_user)"
        
        return f"async def {func_name}({args}\n):"

    content = re.sub(r"async def (\w+)\((.*?)\):", replace_handler, content, flags=re.DOTALL)
    
    # 3. Replace token assignment
    content = re.sub(r"token\s*=\s*resolve_token\(x_forwarded_access_token,\s*authorization\)", r"token = user.raw_token", content)

    # Clean up double commas or empty lines in args
    content = content.replace(",,", ",")
    
    with open(file_path, "w") as f:
        f.write(content)

print("Done.")
