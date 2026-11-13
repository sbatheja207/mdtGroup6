import { describe, expect, it } from "vitest";
import {
  demoDetails,
  emptyDetails,
  suggestDetails,
  validateDetails,
} from "./plan";
import { validateFile } from "./extract";
describe("plan intake", () => {
  it("preserves identifier prefixes and leading zeroes", () => {
    expect(
      suggestDetails(
        "Member ID: AB00123\nGroup Number: 00042\nPolicy number: P-200",
      ),
    ).toEqual({
      memberId: "AB00123",
      groupNumber: "00042",
      policyNumber: "P-200",
    });
  });
  it("does not invent identifiers from generic coverage text", () => {
    expect(
      suggestDetails("Members have coverage for preventive services."),
    ).toEqual({});
  });
  it("requires insurer and member ID while allowing absent group/policy", () => {
    expect(validateDetails(emptyDetails)).toBeTruthy();
    expect(validateDetails({ ...demoDetails, memberId: " " })).toBeTruthy();
    expect(
      validateDetails({ ...demoDetails, groupNumber: "", policyNumber: "" }),
    ).toBeNull();
  });
  it("rejects reversed coverage dates", () => {
    expect(
      validateDetails({ ...demoDetails, endDate: "2020-01-01" }),
    ).toBeTruthy();
  });
  it("rejects unsupported, oversized, and empty uploads", () => {
    expect(
      validateFile(new File(["hello"], "test.html", { type: "text/html" })),
    ).toBeTruthy();
    expect(
      validateFile(new File([], "empty.pdf", { type: "application/pdf" })),
    ).toBeTruthy();
    expect(
      validateFile(
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", {
          type: "application/pdf",
        }),
      ),
    ).toBeTruthy();
    expect(
      validateFile(new File(["test"], "card.png", { type: "image/png" })),
    ).toBeNull();
  });
});

describe("real card layouts", () => {
  it("prefills the supplied Aetna sample from sparse OCR, including a split ID and next-line name", () => {
    const ocr = `NAP\nNAP VENDOR LOGO\nCustomer\naetna\nOR NETWORK LOGO\nLogo\nCUSTOMER NAME LINE ONE\nCUSTOMER NAME LINE TWO\nIssuor: (000000) 0000000000\nManaged Choice Open\nGHP: 000000-000-00000\nAccess AMF Aexcel Plus\nID W1234 56789\nName:\n@1 Jane Doe\nPCP\nABC Family Practice\n@2 Jane Doe\nRX BIN# 610502`;
    expect(suggestDetails(ocr)).toEqual({
      insurer: "Aetna",
      memberId: "W123456789",
      memberName: "Jane Doe",
      groupNumber: "000000-000-00000",
      planName: "Managed Choice Open Access AMF Aexcel Plus",
    });
  });
  it("does not confuse pharmacy routing numbers or issuer numbers with the member ID", () => {
    expect(
      suggestDetails("Issuer: 123456\nRX BIN# 610502\nRX PCN: TEST"),
    ).toEqual({});
  });
  it("does not consume a neighboring label when a value is missing", () => {
    expect(
      suggestDetails(
        "Member ID:\nGroup number: 0042\nName:\nPolicy number: 100",
      ),
    ).toEqual({ groupNumber: "0042", policyNumber: "100" });
  });
  it("reads an identifier on the next line and preserves zeroes", () => {
    expect(suggestDetails("Subscriber ID:\nAB 00123\nGroup: 00005")).toEqual({
      memberId: "AB00123",
      groupNumber: "00005",
    });
  });
});
