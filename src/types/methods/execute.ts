import { VKUser, VKGroup } from '..';

export type ExecuteGetProfiles = (VKUser | VKGroup)[];

export interface ExecuteGetProfilesParams {
  profile_ids: number | string
  fields?: string
  func_v: 2
}
