import { NavMenu } from "./NavMenu";
import { IconUser, IconLogIn, IconUserPlus } from "./Icons";

/** The profile icon: signing in and creating an account. */
export function AccountMenu({ onAuth }) {
  return (
    <NavMenu icon={<IconUser size={18} />} label="Account and sign in">
      {(close) => {
        const pick = (run) => () => { close(); run(); };
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
