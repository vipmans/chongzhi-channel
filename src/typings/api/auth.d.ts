declare namespace Api {
  /**
   * namespace Auth
   *
   * backend api module: "auth"
   */
  namespace Auth {
    interface SessionUser {
      id: string;
      username: string;
      displayName: string;
      status: string;
      roleCodes: string[];
    }

    interface LoginToken {
      accessToken: string;
      refreshToken: string;
      expiresInSeconds: number;
      user: SessionUser;
    }

    interface UserInfoResponse extends SessionUser {
      permissions?: string[];
    }

    interface UserInfo {
      userId: string;
      userName: string;
      displayName: string;
      status: string;
      roles: string[];
      buttons: string[];
    }
  }
}
