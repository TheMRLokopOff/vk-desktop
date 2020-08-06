interface GetApplicationTokenParams {
  app_id: number
  scope?: string | number

  login: string
  password: string
  code?: number

  captcha_sid?: string
  captcha_key?: string
}

export function getApplicationToken(params: GetApplicationTokenParams) {
  return params;
}
