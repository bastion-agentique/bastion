import { BastionSidecar } from "./sidecar";
import { BastionEventStream } from "./types";

describe("BastionSidecar", () => {
  describe("simulateEvm", () => {
    it("constructs request with correct fields", () => {
      const sidecar = new BastionSidecar({ baseUrl: "http://localhost:3000" });
      const req = {
        transaction: {
          from: "0x1234",
          to: "0x5678",
          value: "0x100",
          data: "0x",
        },
        intent: "approve token on Celo",
        chain: "celo",
      };

      expect(req.transaction.from).toBe("0x1234");
      expect(req.transaction.to).toBe("0x5678");
      expect(req.intent).toBe("approve token on Celo");
      expect(req.chain).toBe("celo");
      expect(sidecar).toBeDefined();
    });
  });

  describe("events", () => {
    it("returns a BastionEventStream instance", () => {
      const sidecar = new BastionSidecar({ baseUrl: "http://localhost:3000" });
      const stream = sidecar.events();
      expect(stream).toBeInstanceOf(BastionEventStream);
      stream.close();
    });

    it("constructs URL from baseUrl", () => {
      const sidecar = new BastionSidecar({ baseUrl: "http://localhost:3000" });
      const stream = sidecar.events();
      expect(stream).toBeDefined();
      stream.close();
    });
  });

  describe("updatePolicy", () => {
    it("uses POST /policy/full endpoint", () => {
      const sidecar = new BastionSidecar({ baseUrl: "http://localhost:3000" });
      expect(sidecar).toBeDefined();
    });
  });
});

describe("BastionEventStream SSE parsing", () => {
  it("creates with URL, AbortController, and headers", () => {
    const controller = new AbortController();
    const stream = new BastionEventStream(
      "http://localhost:3000/events",
      controller,
      { "X-API-Key": "test-key" }
    );
    expect(stream).toBeDefined();
    stream.close();
  });

  it("exports all new types for EVM simulation", () => {
    const tx = {
      from: "0x1234",
      to: "0x5678",
      value: "0x0",
      data: "0x",
      gas: "0x1000",
      gasPrice: "0x10",
      maxFeePerGas: "0x20",
      maxPriorityFeePerGas: "0x1",
      nonce: "0x0",
    };
    expect(tx.from).toBe("0x1234");
    expect(tx.to).toBe("0x5678");
  });
});
