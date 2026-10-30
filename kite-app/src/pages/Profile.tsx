import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  IconBack,
  IconBell,
  IconCube,
  IconFile,
  IconGear,
  IconLifebuoy,
  IconLock,
  IconLogout,
  IconPhone,
  IconQuestion,
  IconRupee,
  IconUser,
  IconUserPlus,
} from "@/components/Icons";
import { Fab } from "@/components/Shell";
import { fmt } from "@/lib/format";
import { useApp } from "@/state/AppContext";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "U";

export default function Profile() {
  const { user, profile, privacy, setPrivacy, logout } = useApp();
  const nav = useNavigate();
  const [funds, setFunds] = useState(false);
  const name = profile?.name || user?.name || "";

  if (funds) return <Funds onBack={() => setFunds(false)} />;

  const doLogout = () => {
    logout();
    nav("/login", { replace: true });
  };

  return (
    <div className="screen profile">
      <div className="pf-head">
        <div className="pf-name">{name}</div>
        <IconBell size={20} className="c-dark" />
      </div>
      <div className="screen-body">
        <div className="pf-card">
          <div>
            <div className="pf-id">{profile?.clientId || ""}</div>
            <div className="pf-email">{profile?.email || user?.email}</div>
          </div>
          <div className="pf-avatar">{initials(name)}</div>
        </div>
        <div className="pf-privacy">
          <span>Privacy mode</span>
          <button
            type="button"
            className={`toggle${privacy ? " on" : ""}`}
            onClick={() => setPrivacy(!privacy)}
            aria-label="Privacy mode"
          >
            <span />
          </button>
        </div>

        <div className="pf-sec">Account</div>
        <MenuItem label="Funds" Icon={IconRupee} onClick={() => setFunds(true)} />
        <MenuItem label="App Code" Icon={IconLock} />
        <MenuItem label="Profile" Icon={IconUser} />
        <MenuItem label="Settings" Icon={IconGear} />
        <MenuItem label="Connected apps" Icon={IconCube} />
        <MenuItem label="Logout" Icon={IconLogout} onClick={doLogout} />

        <div className="pf-sec">Console</div>
        <div className="pf-links">
          <span>Portfolio</span>
          <span>Tradebook</span>
          <span>P&amp;L</span>
          <span>Tax P&amp;L</span>
          <span>Gift stocks</span>
          <span>Family</span>
          <span>Downloads</span>
        </div>

        <div className="pf-sec">Support</div>
        <MenuItem label="Support portal" Icon={IconLifebuoy} />
        <MenuItem label="User manual" Icon={IconQuestion} />
        <MenuItem label="Contact" Icon={IconPhone} />

        <div className="pf-sec">Others</div>
        <MenuItem label="Invite friends" Icon={IconUserPlus} />
        <MenuItem label="Licenses" Icon={IconFile} />

        <div className="pf-version">Kite v3.0.0</div>
        <div className="pf-brand">ZERODHA</div>
      </div>
      <Fab />
    </div>
  );
}

function MenuItem({ label, Icon, onClick }: { label: string; Icon: (p: { size?: number }) => JSX.Element; onClick?: () => void }) {
  return (
    <button type="button" className="pf-item" onClick={onClick}>
      <span>{label}</span>
      <span className="pf-item-ico">
        <Icon size={19} />
      </span>
    </button>
  );
}

function Funds({ onBack }: { onBack: () => void }) {
  const { user, positions, privacy } = useApp();
  const used = positions.filter((p) => !p.exited).reduce((a, p) => a + p.avgPrice * p.quantity, 0);
  const avail = user?.walletInr ?? 0;
  const mask = (n: number) => (privacy ? "•••" : fmt(n));
  return (
    <div className="screen profile">
      <div className="os-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Back">
          <IconBack size={20} />
        </button>
        <div className="os-title">Funds</div>
        <span />
      </div>
      <div className="screen-body">
        <div className="funds-card">
          <div className="funds-label">Available margin</div>
          <div className="funds-big c-blue">₹{mask(avail)}</div>
          <div className="kv">
            <span>Used margin</span>
            <span>{mask(used)}</span>
          </div>
          <div className="kv">
            <span>Available cash</span>
            <span>{mask(avail)}</span>
          </div>
          <div className="kv">
            <span>Opening balance</span>
            <span>{mask(avail + used)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
