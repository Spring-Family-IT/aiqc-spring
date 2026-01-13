import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAdmin } from '@/hooks/useAdmin';
import { InviteUserForm } from '@/components/InviteUserForm';
import { PendingInvitations } from '@/components/PendingInvitations';
import { AdminUserList } from '@/components/AdminUserList';
import { ArrowLeft, Shield, Loader2 } from 'lucide-react';

const Admin = () => {
  const navigate = useNavigate();
  const { isAdmin, loading, user } = useAdmin();
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (!loading && !isAdmin) {
      navigate('/');
    }
  }, [loading, user, isAdmin, navigate]);

  const handleInviteSent = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          <InviteUserForm onInviteSent={handleInviteSent} />
          <PendingInvitations refreshTrigger={refreshTrigger} />
          <AdminUserList />
        </div>
      </div>
    </div>
  );
};

export default Admin;
