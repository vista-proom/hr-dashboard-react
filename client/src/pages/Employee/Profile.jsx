import React, { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

export default function Profile() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', id: '', avatarUrl: '', linkedinUrl: '', whatsapp: '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '' });
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (user) setForm({ name: user.name, email: user.email, id: user.id, avatarUrl: user.avatarUrl || '', linkedinUrl: user.linkedinUrl || '', whatsapp: user.whatsapp || '' });
  }, [user]);

  const saveProfile = async () => {
    const { data } = await api.put('/users/me', { name: form.name, avatarUrl: form.avatarUrl, linkedinUrl: form.linkedinUrl, whatsapp: form.whatsapp });
    setUser({ ...user, ...data });
    setMsg('Profile updated');
  };

  const changePassword = async () => {
    await api.put('/users/me/password', pwd);
    setPwd({ currentPassword: '', newPassword: '' });
    setMsg('Password updated');
  };

  return (
    <div className="space-y-4">
      <Card title="My Profile">
        <div className="flex items-start gap-4">
          <img src={form.avatarUrl || 'https://via.placeholder.com/96'} alt="avatar" className="w-24 h-24 rounded-full border" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            <div>
              <label className="block text-sm mb-1">Name</label>
              <input className="w-full border rounded px-3 py-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm mb-1">Email</label>
              <input className="w-full border rounded px-3 py-2 bg-gray-50" value={form.email} disabled />
            </div>
            <div>
              <label className="block text-sm mb-1">ID</label>
              <input className="w-full border rounded px-3 py-2 bg-gray-50" value={form.id} disabled />
            </div>
            <div>
              <label className="block text-sm mb-1">Profile Picture URL</label>
              <input className="w-full border rounded px-3 py-2" value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm mb-1">LinkedIn</label>
              <input className="w-full border rounded px-3 py-2" value={form.linkedinUrl} onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm mb-1">WhatsApp</label>
              <input className="w-full border rounded px-3 py-2" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button onClick={saveProfile} className="bg-blue-600 text-white px-4 py-2 rounded">Save Profile</button>
        </div>
      </Card>

      <Card title="Change Password">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm mb-1">Current Password</label>
            <input type="password" className="w-full border rounded px-3 py-2" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm mb-1">New Password</label>
            <input type="password" className="w-full border rounded px-3 py-2" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} />
          </div>
          <div className="flex items-end"><button onClick={changePassword} className="bg-gray-700 text-white px-4 py-2 rounded">Update Password</button></div>
        </div>
      </Card>

      {msg && <div className="text-green-700 text-sm">{msg}</div>}
    </div>
  );
}