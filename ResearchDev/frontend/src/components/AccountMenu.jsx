import { NavMenu } from "./NavMenu";
import { IconUser, IconLogIn, IconUserPlus } from "./Icons";

/** The profile icon: signed-out shows Sign in / Sign up; signed-in shows
 *  the user's name, a Profile link and Sign out. */
export function AccountMenu({ onAuth, user, onProfile, onSignOut }) {
  const signedIn = !!user;

  return (
    <NavMenu icon={<IconUser size={18} />} label={signedIn ? user.full_name : "Account and sign in"}>
      {(close) => {
        const pick = (run) => () => { close(); run(); };
        if (signedIn) {
          return (
            <>
              <p className="nav-menu-label">Signed in as</p>
              <p className="nav-menu-user">{user.full_name}<br /><span>{user.email}</span></p>
              <button role="menuitem" onClick={pick(() => onProfile?.())}>
                <IconUser size={15} /> Profile
              </button>
              <button role="menuitem" onClick={pick(() => onSignOut?.())}>
                <IconLogIn size={15} /> Sign out
              </button>
            </>
          );
        }
        return (
          <>
            <p className="nav-menu-label">Account</p>
            <button role="menuitem" onClick={pick(() => onAuth("signin"))}>
              <IconLogIn size={15} /> Sign in
            </button>
            <button role="menuitem" onClick={pick(() => onAuth("signup"))}>
              <IconUserPlus size={15} /> Sign up
            </button>
          </>
        );
      }}
    </NavMenu>
  );
}
