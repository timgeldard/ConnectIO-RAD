const assert = require("node:assert/strict");
const { describe, it } = require("node:test");

const { planBoundedContextFiles, toNames } = require("../../../tools/generators/bounded-context/index");

describe("bounded-context generator planning", () => {
  it("normalizes app and context names for spc/trace2-style packages", () => {
    const names = toNames({ name: "supplier-quality", domain: "quality" });

    assert.equal(names.appName, "supplier-quality");
    assert.equal(names.projectName, "supplierquality");
    assert.equal(names.backendPackageName, "supplierquality_backend");
    assert.equal(names.contextName, "supplier_quality");
    assert.equal(names.className, "SupplierQuality");
    assert.equal(names.displayName, "Supplier Quality");
  });

  it("plans backend, frontend, e2e, Databricks, and agent-kit files", () => {
    const files = planBoundedContextFiles({ name: "supplier-quality", domain: "quality" });

    assert(files.includes("apps/supplier-quality/backend/project.json"));
    assert(files.includes("apps/supplier-quality/frontend/project.json"));
    assert(files.includes("apps/supplier-quality/e2e/project.json"));
    assert(files.includes("apps/supplier-quality/databricks.yml"));
    assert(files.includes("apps/supplier-quality/.ai-dev-kit/module-contract.md"));
    assert(files.includes("apps/supplier-quality/backend/supplierquality_backend/supplier_quality/domain/entities.py"));
    assert(files.includes("apps/supplier-quality/backend/supplierquality_backend/supplier_quality/domain/value_objects.py"));
    assert(files.includes("apps/supplier-quality/backend/supplierquality_backend/supplier_quality/routers/router.py"));
    assert(files.includes("apps/supplier-quality/frontend/src/supplier-quality/pages/SupplierQualityPage.tsx"));
  });
});
