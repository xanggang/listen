export class ApiError extends Error {
  status: number;
  code: string;
  /** 携带可公开的状态码和业务错误码，供统一错误处理中间件使用。 */
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
