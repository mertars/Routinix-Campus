export type SmsSendResult = {
  success: boolean;
  providerRef?: string;
  error?: string;
};

export interface SmsProvider {
  readonly name: string;
  send(to: string, message: string): Promise<SmsSendResult>;
}
