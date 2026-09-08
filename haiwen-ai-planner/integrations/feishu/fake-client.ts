import type { FeishuApi, FeishuRecord } from "./types";

export class FakeFeishuClient implements FeishuApi {
  readonly messages: string[] = [];
  readonly records = new Map<string, FeishuRecord[]>();
  failure?: Error;
  private nextId = 1;
  createRecord(tableId: string, fields: Record<string, unknown>) {
    if (this.failure) {
      throw this.failure;
    }
    const record = { fields: { ...fields }, recordId: `record-${this.nextId}` };
    this.nextId += 1;
    this.records.set(tableId, [...(this.records.get(tableId) ?? []), record]);
    return Promise.resolve(record);
  }
  updateRecord(
    tableId: string,
    recordId: string,
    fields: Record<string, unknown>
  ) {
    if (this.failure) {
      throw this.failure;
    }
    const records = this.records.get(tableId) ?? [];
    const record = records.find((item) => item.recordId === recordId);
    if (record) {
      record.fields = { ...record.fields, ...fields };
    }
    return Promise.resolve();
  }
  findRecordByField(tableId: string, field: string, value: string) {
    if (this.failure) {
      throw this.failure;
    }
    return Promise.resolve(
      (this.records.get(tableId) ?? []).find(
        (record) => record.fields[field] === value
      )
    );
  }
  sendMessage(_receiveId: string, _receiveIdType: string, content: string) {
    if (this.failure) {
      throw this.failure;
    }
    this.messages.push(content);
    return Promise.resolve();
  }
}
