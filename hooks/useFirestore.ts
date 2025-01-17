  import { useState, useEffect, useCallback, useRef } from 'react';
  import { useAuth } from '@/context/AuthContext';
  import {
    deleteAppState as firestoreDeleteAppState,
    updateAdminInfo,
    updatePersonalInfo,
    addProfile as firestoreAddProfile,
    updateProfile as firestoreUpdateProfile,
    deleteProfile as firestoreDeleteProfile,
    addResume as firestoreAddResume,
    updateResume as firestoreUpdateResume,
    deleteResume as firestoreDeleteResume,
    addOpportunity as firestoreAddOpportunity,
    updateOpportunity as firestoreUpdateOpportunity,
    deleteOpportunity as firestoreDeleteOpportunity,
    saveUser,
    getUser,
    getProfiles,
    updateUser,
  } from '@/services/firestoreService';
  import { AppState, ProfileType, ResumeType, OpportunityType, AdminInfoType, PersonalInfoType, UserDataType } from '@/types';
  import debounce from 'lodash/debounce';

  interface UseFirestoreReturn {
    appState: AppState | null;
    userData: UserDataType | null;
    profiles: ProfileType[] | null;
    loading: boolean;
    error: string | null;
    // AdminInfo Methods
    updateAdminInfo: (adminInfo: Partial<AdminInfoType>) => Promise<void>;
    // PersonalInfo Methods
    updatePersonalInfo: (personalInfo: Partial<PersonalInfoType>) => Promise<void>;
    // Profile Methods
    addProfile: (profile: ProfileType) => Promise<void>;
    updateProfile: (profile: ProfileType) => Promise<void>;
    deleteProfile: (profileId: string) => Promise<void>;
    // Resume Methods
    addResume: (profileId: string, resume: ResumeType) => Promise<void>;
    updateResume: (profileId: string, resumeId: string, resume: Partial<ResumeType>) => Promise<void>;
    deleteResume: (profileId: string, resumeId: string) => Promise<void>;
    // Opportunity Methods
    addOpportunity: (profileId: string, opportunity: OpportunityType) => Promise<void>;
    updateOpportunity: (profileId: string, opportunityId: string, opportunity: Partial<OpportunityType>) => Promise<void>;
    deleteOpportunity: (profileId: string, opportunityId: string) => Promise<void>;
    // General Methods
    saveUser: (user: UserDataType) => Promise<void>;
    updateUser: (user: UserDataType) => Promise<void>;
    deleteAppState: () => Promise<void>;
    refreshProfiles: () => Promise<void>;
  }

  export const useFirestore = (): UseFirestoreReturn => {
    const { user } = useAuth();
    const [userData, setUserData] = useState<UserDataType | null>(null);
    const [profiles, setProfiles] = useState<ProfileType[] | null>(null);
    const [appState, setAppState] = useState<AppState | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const lastRefreshTimestamp = useRef<number>(0);

    const debouncedRefreshProfiles = useCallback(
      debounce(async () => {
        if (!user) return;
        const now = Date.now();
        if (now - lastRefreshTimestamp.current < 5000) return; // Prevent refreshes within 5 seconds

        try {
          const refreshedProfiles = await getProfiles();
          setAppState(prevState => {
            if (JSON.stringify(prevState?.profiles) !== JSON.stringify(refreshedProfiles)) {
              lastRefreshTimestamp.current = now;
              return {
                ...prevState!,
                profiles: refreshedProfiles,
              };
            }
            return prevState;
          });
          setProfiles(refreshedProfiles);
        } catch (err) {
          console.error('Failed to refresh profiles:', err);
        }
      }, 1000), // Debounce for 1 second
      [user, getProfiles]
    );

    // Fetch AppState from Firestore and synchronize with localStorage
    useEffect(() => {
      const fetchData = async () => {
        if (!user) {
          setUserData(null);
          setLoading(false);
          return;
        }

        try {
          // Load from localStorage first
          const localData = localStorage.getItem('resumeAppState');
          if (localData) {
            setAppState(JSON.parse(localData));
            setLoading(false);
          }

          // Fetch from Firestore
          const fetchedUserData = await getUser();
          const fetchedProfiles = await getProfiles();

          console.log('Fetched profiles:', fetchedProfiles);
          setUserData(fetchedUserData);
          setProfiles(fetchedProfiles);

          if (fetchedUserData && fetchedProfiles) {
            const fetchedAppState = {userType: fetchedUserData, profiles: fetchedProfiles};
            setAppState(fetchedAppState);
            localStorage.setItem('resumeAppState', JSON.stringify(fetchedAppState));
          }
        } catch (err) {
          setError('Failed to load application state.');
          console.error(err);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }, [user]);

    // Sync appState to localStorage whenever it changes
    useEffect(() => {
      if (appState) {
        console.log('AppState saved to localStorage', appState);
        localStorage.setItem('resumeAppState', JSON.stringify(appState));
      }
    }, [appState]);

    // AdminInfo Methods
    const handleUpdateAdminInfo = useCallback(async (adminInfo: Partial<AdminInfoType>) => {
      if (!user || !appState) return;
      try {
        await updateAdminInfo(adminInfo);
        const updatedAdminInfo = { ...appState.userType.adminInfo, ...adminInfo };
        setAppState({
          ...appState,
          userType: {
            ...appState.userType,
            adminInfo: updatedAdminInfo,
          },
        });
      } catch (err) {
        setError('Failed to update admin information.');
        console.error(err);
      }
    }, [user, appState]);

    // PersonalInfo Methods
    const handleUpdatePersonalInfo = useCallback(async (personalInfo: Partial<PersonalInfoType>) => {
      if (!user || !appState) return;
      try {
        console.log("appState.userType.personalInfo", appState.userType.personalInfo);
        await updatePersonalInfo(personalInfo);
        const updatedPersonalInfo = { ...appState.userType.personalInfo, ...personalInfo };
        setAppState({
          ...appState,
          userType: {
            ...appState.userType,
            personalInfo: updatedPersonalInfo,
          },
        });
      } catch (err) {
        setError('Failed to update personal information.');
        console.error(err);
      }
    }, [user, appState]);

    // Profile Methods
    const handleAddProfile = useCallback(async (profile: ProfileType) => {
      if (!user || !appState) return;
      try {
        await firestoreAddProfile(profile);
        await debouncedRefreshProfiles();
      } catch (err) {
        setError('Failed to add profile.');
        console.error(err);
      }
    }, [user, appState]);

    const handleUpdateProfile = useCallback(async (profile: ProfileType) => {
      if (!user || !appState) return;
      try {
        if (profile.id) {
          await firestoreUpdateProfile(profile.id, profile);
        } else {
          await firestoreAddProfile(profile);
        }
        await debouncedRefreshProfiles();
      } catch (err) {
        setError('Failed to update/add profile.');
        console.error(err);
      }
    }, [user, appState]);

    const handleDeleteProfile = useCallback(async (profileId: string) => {
      if (!user || !appState) return;
      try {
        await firestoreDeleteProfile(profileId);
        await debouncedRefreshProfiles();
      } catch (err) {
        setError('Failed to delete profile.');
        console.error(err);
      }
    }, [user, appState]);

    // Resume Methods
    const handleAddResume = useCallback(async (profileId: string, resume: ResumeType) => {
      if (!user || !appState) return;
      try {
        await firestoreAddResume(profileId, resume);
        await debouncedRefreshProfiles();
      } catch (err) {
        setError('Failed to add resume.');
        console.error(err);
      }
    }, [user, appState]);

    const handleUpdateResume = useCallback(async (profileId: string, resumeId: string, resume: Partial<ResumeType>) => {
      if (!user || !appState) return;
      try {
        await firestoreUpdateResume(profileId, resumeId, resume);
        await debouncedRefreshProfiles();
      } catch (err) {
        setError('Failed to update resume.');
        console.error(err);
      }
    }, [user, appState]);

    const handleDeleteResume = useCallback(async (profileId: string, resumeId: string) => {
      if (!user || !appState) return;
      try {
        await firestoreDeleteResume(profileId, resumeId);
        await debouncedRefreshProfiles();
      } catch (err) {
        setError('Failed to delete resume.');
        console.error(err);
      }
    }, [user, appState]);

    // Opportunity Methods
    const handleAddOpportunity = useCallback(async (profileId: string, opportunity: OpportunityType) => {
      if (!user || !appState) return;
      try {
        await firestoreAddOpportunity(profileId, opportunity);
        await debouncedRefreshProfiles();
      } catch (err) {
        setError('Failed to add opportunity.');
        console.error(err);
      }
    }, [user, appState]);

    const handleUpdateOpportunity = useCallback(async (profileId: string, opportunityId: string, opportunity: Partial<OpportunityType>) => {
      if (!user || !appState) return;
      try {
        await firestoreUpdateOpportunity(profileId, opportunityId, opportunity);
        await debouncedRefreshProfiles();
      } catch (err) {
        setError('Failed to update opportunity.');
        console.error(err);
      }
    }, [user, appState]);

    const handleDeleteOpportunity = useCallback(async (profileId: string, opportunityId: string) => {
      if (!user || !appState) return;
      try {
        await firestoreDeleteOpportunity(profileId, opportunityId);
        await debouncedRefreshProfiles();
      } catch (err) {
        setError('Failed to delete opportunity.');
        console.error(err);
      }
    }, [user, appState]);

    // General Methods

    const handleDeleteAppState = useCallback(async () => {
      if (!user) return;
      try {
        await firestoreDeleteAppState();
        setAppState(null);
        localStorage.removeItem('resumeAppState');
      } catch (err) {
        setError('Failed to delete application state.');
        console.error(err);
      }
    }, [user]);

    const handleSaveUser = useCallback(async (user: UserDataType) => {
      if (!user) return;
      try {
        await saveUser(user);
        console.log('User saved to Firestore', user);
      } catch (err) {
        setError('Failed to save user.');
        console.error(err);
      }
    }, [user]); 

    const handleUpdateUser = useCallback(async (user: UserDataType) => {
      if (!user) return;
      try {
        await updateUser(user);
        setAppState({ 
          ...appState,
          userType: user,
          profiles: appState?.profiles || [], 
        });
        console.log('User updated in Firestore', user);
      } catch (err) {
        setError('Failed to update user.');
        console.error(err);
      } 
    }, [user]);

    return {
      appState,
      profiles,
      userData,
      loading,
      error,
      // AdminInfo Methods
      updateAdminInfo: handleUpdateAdminInfo,
      // PersonalInfo Methods
      updatePersonalInfo: handleUpdatePersonalInfo,
      // Profile Methods
      addProfile: handleAddProfile,
      updateProfile: handleUpdateProfile,
      deleteProfile: handleDeleteProfile,
      // Resume Methods
      addResume: handleAddResume,
      updateResume: handleUpdateResume,
      deleteResume: handleDeleteResume,
      // Opportunity Methods
      addOpportunity: handleAddOpportunity,
      updateOpportunity: handleUpdateOpportunity,
      deleteOpportunity: handleDeleteOpportunity,
      // General Methods
      saveUser: handleSaveUser,
      updateUser: handleUpdateUser,
      deleteAppState: handleDeleteAppState,
      refreshProfiles: () => debouncedRefreshProfiles() || Promise.resolve(),
    };
  };